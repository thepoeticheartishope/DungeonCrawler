// Unit tests for dungeon.js buildRestLayout(): the one-room layout a rest
// floor is built on, checked over many random turns of every rest drawing.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { key } from '../js/state.js';
import { REST_GRID, VIEWPORT_SIZE } from '../js/config.js';
import { buildRestLayout } from '../js/dungeon.js';
import { ROOM_TEMPLATES } from '../js/rooms.js';

const LAYOUTS_PER_DRAWING = 40;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const REST_ROOMS = ROOM_TEMPLATES.filter(t => t.role === 'rest');

// Every rest drawing, many times over, so every turn and mirror shows up.
function eachLayout(check) {
  REST_ROOMS.forEach(tpl => {
    for (let i = 0; i < LAYOUTS_PER_DRAWING; i++) check(buildRestLayout(tpl.name, REST_GRID), tpl.name);
  });
}

// Walking steps from `from` to every room tile it can reach.
function walkDistances(layout, from) {
  const dist = new Map([[key(from.row, from.col), 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    for (const [dr, dc] of DIRS) {
      const next = { row: cur.row + dr, col: cur.col + dc };
      const k = key(next.row, next.col);
      if (!layout.roomTiles.has(k) || dist.has(k)) continue;
      dist.set(k, d + 1);
      queue.push(next);
    }
  }
  return dist;
}

test('there is a rest drawing, and the rest grid is no smaller than the view', () => {
  assert.ok(REST_ROOMS.length > 0);
  assert.ok(REST_GRID >= VIEWPORT_SIZE, `REST_GRID ${REST_GRID} < VIEWPORT_SIZE ${VIEWPORT_SIZE}`);
});

test('a rest layout is one chamber, not a boss room, walled in all round', () => {
  eachLayout((layout, name) => {
    assert.equal(layout.chambers.length, 1);
    const room = layout.chambers[0];
    assert.equal(room.name, name);
    assert.equal(room.isBoss, false);
    assert.equal(layout.roomTiles.size, room.floorCells.length);
    for (let r = 0; r < REST_GRID; r++) {
      for (let c = 0; c < REST_GRID; c++) {
        const k = key(r, c);
        assert.notEqual(layout.walls.has(k), layout.roomTiles.has(k), `tile ${k} is both or neither`);
      }
    }
    layout.roomTiles.forEach(k => {
      const [r, c] = k.split(',').map(Number);
      assert.ok(r > 0 && c > 0 && r < REST_GRID - 1 && c < REST_GRID - 1, `room tile ${k} on the grid edge`);
      assert.equal(layout.chamberAt.get(k), 0);
    });
  });
});

test('start and stairs are on room floor, apart, and off the paper spots', () => {
  eachLayout(layout => {
    const slotKeys = new Set(layout.chambers[0].slots.map(s => key(s.row, s.col)));
    [layout.start, layout.stairs].forEach(p => {
      const k = key(p.row, p.col);
      assert.ok(layout.roomTiles.has(k), `${k} is not room floor`);
      assert.ok(!slotKeys.has(k), `${k} is a paper spot`);
    });
    assert.notDeepEqual(layout.start, layout.stairs);
    assert.deepEqual(layout.spawn, layout.stairs);
    layout.chambers[0].slots.forEach(s => assert.ok(layout.roomTiles.has(key(s.row, s.col))));
  });
});

test('the player starts beside the walled-up way in', () => {
  eachLayout(layout => {
    const besideWall = DIRS.filter(([dr, dc]) => layout.walls.has(key(layout.start.row + dr, layout.start.col + dc)));
    assert.ok(besideWall.length > 0, 'start is not against a wall');
  });
});

test('every room tile can be walked to from the start, and the stairs are on the far side', () => {
  eachLayout(layout => {
    const dist = walkDistances(layout, layout.start);
    assert.equal(dist.size, layout.roomTiles.size, 'some room floor cannot be reached');
    const farthest = Math.max(...dist.values());
    const toStairs = dist.get(key(layout.stairs.row, layout.stairs.col));
    assert.ok(toStairs * 2 >= farthest, `stairs ${toStairs} steps away, room reaches ${farthest}`);
  });
});

test('a rest room name that does not exist throws', () => {
  assert.throws(() => buildRestLayout('no-such-room', REST_GRID));
});
