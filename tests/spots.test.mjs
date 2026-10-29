// Unit tests for room spots (js/spots.js, room spots plan step A): every
// School spot is on its room's furniture with kinds the game knows; a roll
// gives nothing SPOT_EMPTY_CHANCE of the time, else one of the spot's own
// kinds; a spot whose furniture was left out is left out; and a plan with
// a spot off its furniture is a mistake.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CORE_KEYS, SPOT_KINDS, SPOT_EMPTY_CHANCE } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { rollSpots } from '../js/spots.js';
import { withRandom } from './helpers.mjs';

// The School's furniture as props, as decor.js lays it down.
function schoolProps(layout) {
  const props = [];
  layout.chambers.forEach(ch => ch.furniture.forEach(([piece, row, col, width = 1]) => {
    for (let i = 0; i < width; i++) props.push({ row, col: col + i, kind: 'furniture', piece });
  }));
  return props;
}

test('every School spot is on its own room\'s furniture, with known kinds, never the start or boss room', () => {
  const layout = buildPlanLayout(FLOOR_PLANS.school, CORE_KEYS, 'A');
  const all = layout.chambers.flatMap(ch => ch.spots);
  assert.ok(all.length >= 8, 'the School has its spots');
  layout.chambers.forEach(ch => {
    const hasStart = ch.floorCells.some(p => p.row === layout.start.row && p.col === layout.start.col);
    if (ch.isBoss || hasStart) assert.equal(ch.spots.length, 0, ch.name + ' has no spots');
    ch.spots.forEach(([, , kinds]) => kinds.forEach(k => assert.ok(SPOT_KINDS.includes(k))));
  });
});

test('a roll below SPOT_EMPTY_CHANCE leaves every spot empty; above it, each holds one of its own kinds', () => {
  const layout = buildPlanLayout(FLOOR_PLANS.school, CORE_KEYS, 'A');
  const props = schoolProps(layout);
  const empty = withRandom(SPOT_EMPTY_CHANCE - 0.01, () => rollSpots(layout, props));
  assert.ok(empty.length > 0 && empty.every(s => s.kind === null && !s.used));
  const live = withRandom(0.99, () => rollSpots(layout, props));
  const allowed = new Map(layout.chambers.flatMap(ch => ch.spots).map(([r, c, kinds]) => [r + ',' + c, kinds]));
  live.forEach(s => assert.ok(allowed.get(s.row + ',' + s.col).includes(s.kind)));
});

test('about a third of spots are empty over many rolls', () => {
  const layout = buildPlanLayout(FLOOR_PLANS.school, CORE_KEYS, 'A');
  const props = schoolProps(layout);
  let empty = 0, total = 0;
  for (let i = 0; i < 400; i++) rollSpots(layout, props).forEach(s => { total++; if (!s.kind) empty++; });
  const share = empty / total;
  assert.ok(share > SPOT_EMPTY_CHANCE - 0.06 && share < SPOT_EMPTY_CHANCE + 0.06, 'empty share ' + share.toFixed(2));
});

test('a spot whose furniture was left out is left out', () => {
  const layout = buildPlanLayout(FLOOR_PLANS.school, CORE_KEYS, 'A');
  const [row, col] = layout.chambers.flatMap(ch => ch.spots)[0];
  const props = schoolProps(layout).filter(p => !(p.row === row && p.col === col));
  const spots = rollSpots(layout, props);
  assert.ok(!spots.some(s => s.row === row && s.col === col));
});

test('a plan with a spot off its furniture, or an unknown kind, throws', () => {
  const plan = FLOOR_PLANS.school;
  const moved = rooms => ({ ...plan, rooms });
  const off = plan.rooms.map(r => (r.name === 'plan.school.lab' ? { ...r, spots: [[5, 5, ['hide']]] } : r));
  assert.throws(() => buildPlanLayout(moved(off), CORE_KEYS, 'A'), /not on furniture/);
  const odd = plan.rooms.map(r => (r.name === 'plan.school.lab' ? { ...r, spots: [[2, 8, ['jetpack']]] } : r));
  assert.throws(() => buildPlanLayout(moved(odd), CORE_KEYS, 'A'), /unknown kind/);
});
