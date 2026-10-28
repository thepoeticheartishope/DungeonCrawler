// Unit tests for lamps (js/lamps.js, presence cues plan step A): a plan's
// `L` is a lamp; its pool stays on open floor it has a clear line to; a
// stick man in a pool is seen from farther than REVEAL_DISTANCE and from
// outside the room, but only up to LAMP_LIGHT.seeFrom, with a clear line,
// and while the lamps are on (not after the boss falls); and seeing him by
// lamp light never lets the player shoot him (shootBlock).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { CORE_KEYS, LAMP_LIGHT, REVEAL_DISTANCE } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { placeLamps, lampPool } from '../js/lamps.js';
import { seesEnemy, shootBlock, clearLine, computeVisibility } from '../js/sight.js';

// The School's long hallway runs along row 9; a lamp goes at (9, 18), in
// place of the School's own lamps.
const LAMP = { row: 9, col: 18 };

// The School laid out (version A) on state.floor with one lamp at LAMP, the
// player at (9, 10) in the hallway, 8 tiles from it, with only their own
// tile lit.
function school() {
  const plan = FLOOR_PLANS.school;
  const rows = plan.rows.map(row => row.replace(/L/g, '.'));
  rows[LAMP.row] = rows[LAMP.row].slice(0, LAMP.col) + 'L' + rows[LAMP.row].slice(LAMP.col + 1);
  const layout = buildPlanLayout({ ...plan, rows }, CORE_KEYS, 'A');
  const f = state.floor;
  f.GRID_SIZE = rows.length;
  f.wallSet = layout.walls;
  f.chamberAt = layout.chamberAt;
  f.pillarSet = new Set();
  f.windowLitSet = new Set();
  f.darkness = false;
  placeLamps(layout);
  f.playerRow = 9;
  f.playerCol = 10;
  f.sightSet = new Set([key(9, 10)]);
  state.settings.fogEnabled = true;
  return layout;
}

test('a plan’s L is a lamp on open floor', () => {
  const layout = school();
  assert.deepEqual(layout.lamps, [LAMP]);
  assert.deepEqual(state.floor.lamps, [LAMP]);
  assert.ok(!state.floor.wallSet.has(key(LAMP.row, LAMP.col)));
});

test('the School has its four lamps on open floor in both versions', () => {
  ['A', 'B'].forEach(v => {
    const layout = buildPlanLayout(FLOOR_PLANS.school, CORE_KEYS, v);
    assert.deepEqual(layout.lamps, [{ row: 9, col: 16 }, { row: 15, col: 9 }, { row: 15, col: 23 }, { row: 21, col: 16 }]);
    layout.lamps.forEach(l => assert.ok(!layout.walls.has(key(l.row, l.col)), v + ' ' + l.row + ',' + l.col));
  });
});

test('a lamp’s pool is open floor within its radius, with a clear line to the lamp', () => {
  school();
  const pool = lampPool(LAMP);
  assert.ok(pool.some(p => p.row === LAMP.row && p.col === LAMP.col), 'the lamp lights its own tile');
  pool.forEach(p => {
    assert.ok(!state.floor.wallSet.has(key(p.row, p.col)));
    assert.ok(Math.hypot(p.row - LAMP.row, p.col - LAMP.col) <= LAMP_LIGHT.radius);
    assert.ok(clearLine(LAMP.row, LAMP.col, p.row, p.col));
    assert.ok(state.floor.lampPoolSet.has(key(p.row, p.col)));
  });
});

test('a stick man in a lamp’s pool is seen from afar, but can’t be shot by it', () => {
  school();
  const m = { ...LAMP };
  assert.ok(Math.max(Math.abs(m.row - 9), Math.abs(m.col - 10)) > REVEAL_DISTANCE, 'farther than the player’s own light shows');
  assert.ok(seesEnemy(m), 'seen in the lamp’s pool');
  assert.ok(shootBlock(m) !== null, 'not shootable without the player’s own light');
  state.floor.lampPoolSet = new Set();
  assert.ok(!seesEnemy(m), 'not seen once out of the pool');
});

test('lamp light is seen only within LAMP_LIGHT.seeFrom and with a clear line', () => {
  school();
  const f = state.floor;
  // A lamp at the hallway's far end, (9, 23).
  const far = { row: 9, col: 23 };
  placeLamps({ lamps: [far] });
  f.playerCol = far.col - LAMP_LIGHT.seeFrom - 1;
  assert.ok(!f.wallSet.has(key(f.playerRow, f.playerCol)), 'the player stands in the hallway');
  assert.ok(!seesEnemy(far), 'too far away');
  f.playerCol = far.col - LAMP_LIGHT.seeFrom;
  assert.ok(seesEnemy(far), 'just in reach');
  f.pillarSet = new Set([key(9, far.col - 2)]);
  assert.ok(!seesEnemy(far), 'a pillar in between hides it');
});

test('the lamps go out when the boss falls', () => {
  school();
  state.floor.darkness = true;
  assert.ok(!seesEnemy({ ...LAMP }));
  state.floor.darkness = false;
});

test('the lamp-lit tiles the player can see join visibleSet', () => {
  school();
  const f = state.floor;
  f.bossLitSet = new Set();
  f.spotSet = new Set();
  f.safeRoom = null;
  f.exploredSet = new Set();
  f.props = [];
  computeVisibility();
  assert.ok(f.visibleSet.has(key(LAMP.row, LAMP.col)));
  assert.ok(!f.sightSet.has(key(LAMP.row, LAMP.col)), 'not the player’s own light');
});
