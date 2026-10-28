// Unit tests for plans.js: every fixed plan keeps its own rules in both
// versions, and buildPlanLayout lays it out the way floor.js expects.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FOUR_STEPS } from '../js/grid.js';
import { key } from '../js/state.js';
import { CORE_KEYS } from '../js/config.js';
import { FLOOR_PLANS, PLAN_VERSIONS, buildPlanLayout } from '../js/plans.js';
import { FLOOR_RECIPES } from '../js/floors.js';
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

function eachPlanVersion(check) {
  Object.entries(FLOOR_PLANS).forEach(([id, plan]) => {
    PLAN_VERSIONS.forEach(v => check(buildPlanLayout(plan, CORE_KEYS, v), plan, id + ' ' + v));
  });
}

test('every recipe\'s plan exists', () => {
  FLOOR_RECIPES.forEach(r => { if (r.plan) assert.ok(FLOOR_PLANS[r.plan], r.plan); });
});

test('the start reaches every open tile, and the stairs only through the gate', () => {
  eachPlanVersion((layout, plan, label) => {
    const size = plan.rows.length;
    const open = size * size - layout.walls.size;
    assert.equal(stepsFrom(layout, size, layout.start).size, open, label + ': tiles cut off');
    const gate = new Set([key(layout.spawn.row, layout.spawn.col)]);
    assert.ok(!stepsFrom(layout, size, layout.start, gate).has(key(layout.stairs.row, layout.stairs.col)), label + ': stairs reachable without the gate');
  });
});

test('the core is one room with the gate as its only doorway and the stairs inside', () => {
  eachPlanVersion((layout, plan, label) => {
    const cores = layout.chambers.filter(ch => ch.isBoss);
    assert.equal(cores.length, 1, label);
    const core = layout.chambers.indexOf(cores[0]);
    assert.deepEqual([...cores[0].doorKeys], [key(layout.spawn.row, layout.spawn.col)], label + ': core doorways');
    assert.equal(layout.chamberAt.get(key(layout.stairs.row, layout.stairs.col)), core, label + ': stairs outside the core');
    assert.notEqual(layout.chamberAt.get(key(layout.start.row, layout.start.col)), core, label + ': start in the core');
  });
});

test('no key spot is in the core or the start room, and keys go in different rooms', () => {
  eachPlanVersion((layout, plan, label) => {
    const core = layout.chambers.findIndex(ch => ch.isBoss);
    const startRoom = layout.chamberAt.get(key(layout.start.row, layout.start.col));
    layout.keySpots.forEach(p => {
      const room = layout.chamberAt.get(key(p.row, p.col));
      assert.notEqual(room, core, label + ': key spot in the core');
      assert.notEqual(room, startRoom, label + ': key spot in the start room');
    });
    for (let i = 0; i < 20; i++) {
      const again = buildPlanLayout(plan, CORE_KEYS, layout.version);
      assert.equal(again.keys.length, CORE_KEYS, label);
      const rooms = again.keys.map(p => again.chamberAt.get(key(p.row, p.col))).filter(r => r !== undefined);
      assert.equal(new Set(rooms).size, rooms.length, label + ': two keys in one room');
    }
  });
});

test('each room\'s doorways are its own floor, and every room tile is in the room tiles', () => {
  eachPlanVersion((layout, plan, label) => {
    layout.chambers.forEach((ch, i) => {
      ch.doorKeys.forEach(k => assert.equal(layout.chamberAt.get(k), i, label + ' ' + ch.name));
      ch.floorCells.forEach(p => assert.ok(layout.roomTiles.has(key(p.row, p.col)), label + ' ' + ch.name));
    });
  });
});

test('a version is picked at random when none is given, and both come up', () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(buildPlanLayout(FLOOR_PLANS.school, CORE_KEYS).version);
  assert.deepEqual([...seen].sort(), PLAN_VERSIONS);
});

test('every plan and every room has a name with wording, and no two rooms share one', () => {
  Object.values(FLOOR_PLANS).forEach(plan => {
    assert.ok(plan.name in TEXT, plan.name);
    plan.rooms.forEach(room => assert.ok(room.name in TEXT, room.name));
    const names = plan.rooms.map(room => TEXT[room.name]);
    assert.equal(new Set(names).size, names.length, plan.name + ': two rooms share a name');
  });
});
