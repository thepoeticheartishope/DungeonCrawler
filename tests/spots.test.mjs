// Unit tests for room spots (js/spots.js, room spots plan steps A and B): every
// School spot is on its room's furniture with kinds the game knows; a roll
// gives nothing SPOT_EMPTY_CHANCE of the time, else one of the spot's own
// kinds; a spot whose furniture was left out is left out; and a plan with
// a spot off its furniture is a mistake. Step B: a live hide spot hides
// the player, a step brings them out (beside the piece if the way in is
// taken), and while hidden nothing strikes them and the book stays down.
// Step C: a pushed takedown falls away from the player, kills what is
// under it for TAKEDOWN_GOLD_TIMES its gold, falls even with nobody there,
// is spent and stops blocking, and won't tip sideways or onto a wall.
// Step D: a live lure sounds once from the piece itself, drawing stick men
// (a test room's too) to it and away from the player.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CORE_KEYS, SPOT_KINDS, SPOT_EMPTY_CHANCE, MINION_KINDS, TAKEDOWN_GOLD_TIMES } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { rollSpots } from '../js/spots.js';
import { withRandom, emptyFloor, minionAt } from './helpers.mjs';
import { state, key } from '../js/state.js';
import { whatBlocks } from '../js/passage.js';
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

// ---- Step C: takedowns ----

// An empty floor with a 3-wide bookcase two rows north of the player that
// is a live takedown, the player one row south of it. Returns its tiles.
function shelfFloor() {
  emptyFloor(21, { settings: { oneStick: false, lightBattery: false } });
  const f = state.floor;
  const row = f.playerRow - 1, c0 = f.playerCol - 1;
  const tiles = [0, 1, 2].map(i => ({ row, col: c0 + i }));
  f.props = tiles.map((p, i) => ({ ...p, kind: 'furniture', piece: 'shelf', part: ['left', 'mid', 'right'][i], identified: true, searched: false, sprung: false }));
  f.roomSpots = [{ row, col: c0 + 1, kind: 'takedown', used: false, tiles }];
  f.hidden = null;
  state.run.coinsTotal = 0;
  computeVisibility();
  return tiles;
}

test('pushing a live takedown drops it away from the player: a stick man under it dies for twice its gold', () => {
  const tiles = shelfFloor();
  const m = minionAt(-2, 1, 'STALKER');
  const events = stepPlayer(-1, 0);
  assert.ok(events.some(e => e.type === 'toppled' && e.piece === 'shelf'));
  assert.ok(events.some(e => e.type === 'minionKilled' && e.minion === m));
  const gold = events.find(e => e.type === 'goldGained');
  assert.equal(gold.from, 'takedown');
  assert.equal(gold.amount, MINION_KINDS.STALKER.gold * TAKEDOWN_GOLD_TIMES);
  assert.equal(state.run.coinsTotal, gold.amount);
  assert.ok(!state.floor.minions.includes(m));
  assert.ok(state.floor.roomSpots[0].used);
  // It lies one row further on, and no longer blocks: the player walks onto where it stood.
  assert.ok(state.floor.props.every(p => p.fallen && p.row === tiles[0].row - 1));
  assert.equal(whatBlocks(tiles[1].row, tiles[1].col), null);
});

test('a takedown falls even with nobody under it, and is spent', () => {
  shelfFloor();
  const events = stepPlayer(-1, 0);
  assert.ok(events.some(e => e.type === 'toppled'));
  assert.ok(!events.some(e => e.type === 'goldGained'));
  assert.ok(state.floor.roomSpots[0].used);
});

test('a takedown won\'t tip sideways, nor onto a wall', () => {
  const tiles = shelfFloor();
  const f = state.floor;
  f.playerCol = tiles[2].col + 1;
  f.playerRow = tiles[2].row;
  computeVisibility();
  assert.ok(stepPlayer(0, -1).some(e => e.type === 'blocked' && e.kind === 'wontTip'));
  shelfFloor();
  state.floor.wallSet.add(key(tiles[0].row - 1, tiles[0].col));
  assert.ok(stepPlayer(-1, 0).some(e => e.type === 'blocked' && e.kind === 'noRoom'));
  assert.ok(!state.floor.roomSpots[0].used);
});

// ---- Step D: lures ----

// An empty floor with a sink two tiles east of the player that is a live
// lure spot, noise on and the light battery's rules off (so a stick man
// hears whether or not it could see the player).
function sinkFloor() {
  emptyFloor(21, { settings: { oneStick: false, lightBattery: false, noise: true } });
  const f = state.floor;
  const sink = { row: f.playerRow, col: f.playerCol + 1 };
  f.props = [{ ...sink, kind: 'furniture', piece: 'sink', part: 'single', identified: true, searched: false, sprung: false }];
  f.roomSpots = [{ ...sink, kind: 'lure', used: false, tiles: [sink] }];
  f.hidden = null;
  computeVisibility();
  return sink;
}

test('bumping a live lure sounds from the sink itself, once; then it is only a sink', () => {
  const sink = sinkFloor();
  const events = stepPlayer(0, 1);
  assert.ok(events.some(e => e.type === 'lureSounded' && e.piece === 'sink'));
  const made = events.find(e => e.type === 'noiseMade');
  assert.equal(made.kind, 'lure');
  assert.equal(made.tiles.find(t => t.d === 0).col, sink.col, 'the sound starts at the sink, not the player');
  assert.ok(state.floor.roomSpots[0].used);
  const again = stepPlayer(0, 1);
  assert.ok(!again.some(e => e.type === 'lureSounded'));
  assert.ok(again.some(e => e.type === 'blocked' && e.kind === 'furniture'));
});

test('a stick man in its range goes to the sink and searches round it, not to the player', () => {
  const sink = sinkFloor();
  const f = state.floor;
  const m = spawnMinion({ row: f.playerRow - 6, col: f.playerCol + 6 }, 'SHARD');
  const events = stepPlayer(0, 1);
  assert.ok(events.some(e => e.type === 'noiseHeard' && e.minion === m));
  assert.deepEqual(m.lastSeen, { row: sink.row, col: sink.col });
  // Walk the player away west; the stick man still makes for the sink.
  // (Once there it searches round it at random, so only the walk is checked.)
  f.playerCol -= 8;
  computeVisibility();
  const steps = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  for (let i = 0; i < 10 && steps(m, sink) > 1; i++) {
    advanceMonsters();
    assert.ok(steps(m, { row: f.playerRow, col: f.playerCol }) > 3, 'it never came for the player');
  }
  assert.equal(steps(m, sink), 1, 'it came to stand beside the sink');
});

test('a lure draws a test room\'s stick man off its set route', () => {
  const sink = sinkFloor();
  const f = state.floor;
  const m = spawnMinion({ row: f.playerRow - 5, col: f.playerCol - 5 }, 'SHARD');
  m.route = { points: [{ row: m.row, col: m.col }, { row: m.row, col: m.col - 3 }], at: 0, loop: true };
  stepPlayer(0, 1);
  assert.equal(m.route, null);
  assert.deepEqual(m.lastSeen, { row: sink.row, col: sink.col });
});

test('with DEV -> Noise off a lure is still spent, but nothing is heard', () => {
  sinkFloor();
  state.settings.noise = false;
  const events = stepPlayer(0, 1);
  assert.ok(events.some(e => e.type === 'lureSounded'));
  assert.ok(!events.some(e => e.type === 'noiseMade'));
  assert.ok(state.floor.roomSpots[0].used);
});
