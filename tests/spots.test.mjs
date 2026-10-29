// Unit tests for room spots (js/spots.js, room spots plan steps A and B): every
// School spot is on its room's furniture with kinds the game knows; a roll
// gives nothing SPOT_EMPTY_CHANCE of the time, else one of the spot's own
// kinds; a spot whose furniture was left out is left out; and a plan with
// a spot off its furniture is a mistake. Step B: a live hide spot hides
// the player, a step brings them out (beside the piece if the way in is
// taken), and while hidden nothing strikes them and the book stays down.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CORE_KEYS, SPOT_KINDS, SPOT_EMPTY_CHANCE } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { rollSpots } from '../js/spots.js';
import { withRandom, emptyFloor, minionAt } from './helpers.mjs';
import { state } from '../js/state.js';
import { stepPlayer } from '../js/moves.js';
import { advanceMonsters, spawnMinion, clockFrame } from '../js/combat.js';
import { computeVisibility, shootBlock } from '../js/sight.js';

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

// ---- Step B: hiding ----

// An empty floor with a stall north of the player that is a live hide
// spot, and the turn rules (no one stick, no light battery).
function stallFloor() {
  emptyFloor(21, { settings: { oneStick: false, lightBattery: false } });
  const f = state.floor;
  const stall = { row: f.playerRow - 1, col: f.playerCol };
  f.props = [{ ...stall, kind: 'furniture', piece: 'stall', part: 'single', identified: true, searched: false, sprung: false }];
  f.roomSpots = [{ ...stall, kind: 'hide', used: false, tiles: [stall] }];
  f.hidden = null;
  computeVisibility();
  return stall;
}

test('bumping a live hide spot hides the player in it; a step brings them back out where they went in', () => {
  const stall = stallFloor();
  const from = { row: state.floor.playerRow, col: state.floor.playerCol };
  const events = stepPlayer(-1, 0);
  assert.ok(events.some(e => e.type === 'hid' && e.piece === 'stall'));
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [stall.row, stall.col]);
  assert.ok(state.floor.hidden);
  const out = stepPlayer(0, 1);
  assert.ok(out.some(e => e.type === 'hideLeft'));
  assert.equal(state.floor.hidden, null);
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [from.row, from.col]);
});

test('an empty spot is only furniture: bumping it is blocked', () => {
  stallFloor();
  state.floor.roomSpots[0].kind = null;
  const events = stepPlayer(-1, 0);
  assert.ok(events.some(e => e.type === 'blocked' && e.kind === 'furniture'));
  assert.equal(state.floor.hidden, null);
});

test('hidden, a hunting stick man beside the player never strikes, and the book stays down', () => {
  stallFloor();
  stepPlayer(-1, 0);
  const m = minionAt(0, 1, 'SHARD', { hunts: true });
  const hearts = state.run.hearts;
  for (let i = 0; i < 6; i++) {
    const events = advanceMonsters();
    assert.ok(!events.some(e => e.type === 'minionStruck' || e.type === 'struggleStarted'));
    assert.ok(!(m.row === state.floor.playerRow && m.col === state.floor.playerCol));
  }
  assert.equal(state.run.hearts, hearts);
  assert.equal(shootBlock(m), 'hidden');
});

test('hidden with the way in taken, a step comes out beside the piece instead', () => {
  const stall = stallFloor();
  stepPlayer(-1, 0);
  const from = state.floor.hidden.from;
  spawnMinion({ row: from.row, col: from.col }, 'SHARD');
  const out = stepPlayer(1, 0);
  assert.ok(out.some(e => e.type === 'hideLeft'));
  assert.ok(Math.abs(state.floor.playerRow - stall.row) + Math.abs(state.floor.playerCol - stall.col) === 1);
  assert.ok(!(state.floor.playerRow === from.row && state.floor.playerCol === from.col));
});

test('One stick: hidden, a stick man that was reaching misses and none lands over time', () => {
  stallFloor();
  stepPlayer(-1, 0);
  state.settings.oneStick = true;
  const m = minionAt(0, 1, 'SHARD', { hunts: true });
  m.reaching = { left: 50, ms: 50 };
  const hearts = state.run.hearts;
  const events = [];
  for (let i = 0; i < 100; i++) events.push(...clockFrame(50));
  assert.ok(events.some(e => e.type === 'reachMissed'));
  assert.ok(!events.some(e => e.type === 'minionStruck' || e.type === 'struggleStarted'));
  assert.equal(state.run.hearts, hearts);
  state.settings.oneStick = false;
});
