// Unit tests for the gun's rules (js/gun.js): reload offers and answers,
// firing, the damage bar, a minion's strike, and staggering the hunter.
//
// Run: node --test tests/*.test.mjs
//
// Same set-up as rules.test.mjs: a small open floor on the shared `state`,
// reset before each test. Math.random is swapped out where a roll decides
// the outcome.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import {
  GUN_CHAMBER, GUN_RELOAD_ROUNDS, GUN_HIT_HALF, MINION_KINDS, MINION_STRIKE_COST,
  DARK_MISS_COST, DARK_GOLD_MULTIPLIER, HUNTER_REST_TURNS, MAX_HEARTS,
} from '../js/config.js';
import { computeVisibility } from '../js/sight.js';
import { spawnMinion, advanceMonsters, findAdjacentEnemies } from '../js/combat.js';
import { resetHaunts } from '../js/haunts.js';
import {
  reloadCategory, reloadOffers, settleReload, pickTarget, refreshGunTarget, cycleTarget, fireBlock, fire, settleShot,
  minionStrike, staggerHunter,
} from '../js/gun.js';

const SET = [
  { term: 'Who built the ark?', meaning: 'Noah', category: 'OT' },
  { term: 'Who led the exodus?', meaning: 'Moses', category: 'OT' },
  { term: 'Who was the first king?', meaning: 'Saul', category: 'OT' },
  { term: 'Who denied Jesus three times?', meaning: 'Peter', category: 'NT' },
  { term: 'Who wrote Romans?', meaning: 'Paul', category: 'NT' },
  { term: 'Who was a tax collector?', meaning: 'Matthew', category: 'NT' },
  { term: 'How many plagues?', meaning: '10', category: 'Numbers' },
  { term: 'How many tribes?', meaning: '12', category: 'Numbers' },
  { term: 'How many apostles?', meaning: '12 apostles', category: 'Numbers' },
];

// An open floor, player in the middle facing north, a full-ish run.
function resetFloor(size = 21) {
  state.floor.GRID_SIZE = size;
  state.run.roomIndex = 0;
  state.floor.playerRow = Math.floor(size / 2);
  state.floor.playerCol = Math.floor(size / 2);
  state.floor.facing = 'N';
  state.settings.fogEnabled = true;
  state.settings.activeData = SET;
  state.settings.gunCombat = false;
  state.floor.darkness = false;
  state.floor.wallSet = new Set();
  state.floor.pillarSet = new Set();
  state.floor.bossLitSet = new Set();
  state.floor.exploredSet = new Set();
  state.floor.boss = null;
  state.floor.hunter = null;
  state.floor.minions = [];
  state.floor.chest = null;
  state.floor.rune = null;
  state.floor.encounters = [];
  state.floor.props = [];
  state.run.coinsTotal = 0;
  state.run.correctTotal = 0;
  state.run.hearts = MAX_HEARTS;
  state.run.ammo = 1;
  state.run.reloadIndex = 0;
  state.battle.selectedTarget = null;
  state.floor.gunTarget = null;
  state.battle.aim = null;
  state.battle.currentQuestion = SET[0];
  resetHaunts();
  computeVisibility();
}

// A minion `dr`, `dc` tiles from the player, with the light recomputed.
function minionAt(dr, dc, kind = 'SHARD') {
  const m = spawnMinion({ row: state.floor.playerRow + dr, col: state.floor.playerCol + dc }, kind);
  computeVisibility();
  return m;
}

// Runs `fn` with Math.random always returning `value`.
function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
}

// --- reload ---

test('reload offers the next category with no, one and two modifiers', () => {
  resetFloor();
  const { block, category, offers } = reloadOffers();
  assert.equal(block, null);
  assert.deepEqual(category, reloadCategory());
  assert.deepEqual(offers.map(o => o.modifiers.length), [0, 1, 2]);
  assert.deepEqual(offers.map(o => o.rounds), GUN_RELOAD_ROUNDS);
  const all = offers.flatMap(o => o.modifiers);
  assert.ok(!all.includes('gambler'));
  assert.equal(new Set(all).size, 3, 'the three modifiers are all different');
});

test('reload offers say how many rounds still fit, and none when the chamber is full', () => {
  resetFloor();
  state.run.ammo = GUN_CHAMBER - 1;
  assert.deepEqual(reloadOffers().offers.map(o => o.room), [1, 1, 1]);
  state.run.ammo = GUN_CHAMBER;
  assert.equal(reloadOffers().block, 'chamberFull');
});

test('a right reload loads the offer\'s rounds, up to the chamber, and counts as right', () => {
  resetFloor();
  const events = settleReload(true, { modifiers: ['blind', 'flip'], rounds: 3 });
  assert.equal(state.run.ammo, GUN_CHAMBER);
  assert.equal(state.run.correctTotal, 1);
  assert.deepEqual(events[0], { type: 'reloaded', rounds: 3, ammo: GUN_CHAMBER });
});

test('a wrong reload jams: nothing loads, no heart is lost, the miss haunts', () => {
  resetFloor();
  const events = settleReload(false, { modifiers: [], rounds: 1 });
  assert.equal(state.run.ammo, 1);
  assert.equal(state.run.hearts, MAX_HEARTS);
  assert.equal(events[0].type, 'jammed');
  assert.equal(events[0].expected, 'Noah');
  assert.ok(state.run.haunts.has(SET[0]));
});

test('the reload category comes round in order, one step per settled reload', () => {
  resetFloor();
  const first = reloadCategory();
  settleReload(true, { modifiers: [], rounds: 1 });
  const second = reloadCategory();
  assert.notEqual(second.category, first.category);
  settleReload(false, { modifiers: [], rounds: 1 });
  settleReload(false, { modifiers: [], rounds: 1 });
  assert.equal(reloadCategory().category, first.category, 'three categories, so the fourth reload is the first again');
});

test('a set with no categories reloads from the whole set', () => {
  resetFloor();
  state.settings.activeData = SET.map(({ term, meaning }) => ({ term, meaning }));
  const category = reloadCategory();
  assert.equal(category.label, null);
  assert.equal(category.pool, state.settings.activeData);
});

// --- fire ---

test('fire is blocked with an empty chamber, at the boss, or out of the light', () => {
  resetFloor();
  const m = minionAt(-2, 0);
  state.run.ammo = 0;
  assert.equal(fireBlock(m), 'chamberEmpty');
  state.run.ammo = 1;
  assert.equal(fireBlock({ kind: 'boss', row: m.row, col: m.col + 1 }), 'notShootable');
  const behind = minionAt(3, 0);
  assert.equal(fireBlock(behind), 'notInLight');
  const events = fire(behind);
  assert.deepEqual(events, [{ type: 'fireBlocked', target: behind, reason: 'notInLight' }]);
  assert.equal(state.run.ammo, 1, 'a blocked shot spends nothing');
});

test('a shot that misses spends the round and opens no damage bar', () => {
  resetFloor();
  const m = minionAt(-4, 0);
  const events = withRandom(0.99, () => fire(m));
  assert.deepEqual(events.map(e => e.type), ['shotFired', 'shotMissed']);
  assert.equal(state.run.ammo, 0);
  assert.equal(state.battle.aim, null);
});

test('a shot that lands waits for the damage bar with the kind\'s weak point', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'HUSK');
  const events = withRandom(0.5, () => fire(m));
  assert.deepEqual(events.map(e => e.type), ['shotFired', 'aimStarted']);
  assert.equal(events[0].chance, 1);
  assert.deepEqual(state.battle.aim, { target: m, hitHalf: GUN_HIT_HALF, weakWidth: MINION_KINDS.HUSK.weakWidth });
});

test('a landed shot staggers the hunter where it stands', () => {
  resetFloor();
  const h = minionAt(-1, 0);
  h.kind = 'hunter';
  h.minionKind = null;
  const events = withRandom(0, () => fire(h));
  assert.deepEqual(events.map(e => e.type), ['shotFired', 'hunterStaggered']);
  assert.equal(h.rest, HUNTER_REST_TURNS);
  assert.equal(state.battle.aim, null);
  assert.equal(state.floor.minions.length, 1, 'the hunter never dies');
});

// --- pickTarget ---

test('tapping a minion in sight targets it, even out of reach; tapping anything else clears it', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  assert.deepEqual(pickTarget({ row: m.row, col: m.col }), [{ type: 'targetPicked', target: m }]);
  assert.equal(state.floor.gunTarget, m);
  assert.deepEqual(pickTarget({ row: m.row + 1, col: m.col + 3 }), [{ type: 'targetCleared' }]);
  assert.equal(state.floor.gunTarget, null);
});

test('a minion the player can\'t see can\'t be picked', () => {
  resetFloor();
  const m = minionAt(3, 0); // behind the player, out of their light
  assert.deepEqual(pickTarget({ row: m.row, col: m.col }), [{ type: 'targetCleared' }]);
  assert.equal(state.floor.gunTarget, null);
});

// --- settleShot ---

test('the damage bar: graze outside the hit zone, 1 inside it, 2 and a limb at the weak point', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'HUSK');
  withRandom(0, () => fire(m));
  assert.deepEqual(settleShot(0.5 + GUN_HIT_HALF + 0.01).map(e => e.type), ['shotGrazed']);
  assert.equal(m.hpLeft, MINION_KINDS.HUSK.hp);

  state.run.ammo = 2;
  withRandom(0, () => fire(m));
  const hit = settleShot(0.5 - GUN_HIT_HALF);
  assert.deepEqual(hit, [{ type: 'minionHurt', minion: m, damage: 1, hpLeft: 4, weakPoint: false }]);

  withRandom(0, () => fire(m));
  const weak = settleShot(0.5);
  assert.deepEqual(weak.map(e => e.type), ['minionHurt', 'limbLost']);
  assert.equal(m.hpLeft, 2);
  assert.equal(m.limbs, MINION_KINDS.HUSK.limbs - 1);
});

test('a kill takes the minion off the floor and pays its gold, doubled in the darkness', () => {
  resetFloor();
  state.floor.darkness = true;
  const m = minionAt(-1, 0, 'SHARD');
  state.battle.selectedTarget = m;
  state.floor.gunTarget = m;
  withRandom(0, () => fire(m));
  const events = settleShot(0.5);
  const gold = MINION_KINDS.SHARD.gold * DARK_GOLD_MULTIPLIER;
  assert.deepEqual(events.slice(-2), [{ type: 'minionKilled', minion: m }, { type: 'goldGained', amount: gold, from: 'kill' }]);
  assert.equal(state.floor.minions.length, 0);
  assert.equal(state.battle.selectedTarget, null);
  assert.equal(state.floor.gunTarget, null, 'a dead minion is no longer the target');
  assert.equal(state.run.coinsTotal, gold);
});

test('settleShot with no shot waiting does nothing', () => {
  resetFloor();
  assert.deepEqual(settleShot(0.5), []);
});

// --- minionStrike / staggerHunter ---

test('a strike costs stability and knocks the minion back along its trail', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  m.trail = [{ row: m.row - 3, col: m.col }, { row: m.row - 2, col: m.col }, { row: m.row - 1, col: m.col }];
  const start = { row: m.row, col: m.col };
  const events = minionStrike(m);
  assert.deepEqual(events, [
    { type: 'minionStruck', minion: m, cost: MINION_STRIKE_COST },
    { type: 'knockedBack', minion: m, from: start },
  ]);
  assert.equal(state.run.hearts, MAX_HEARTS - MINION_STRIKE_COST);
  assert.equal(m.row, start.row - 3);
  assert.deepEqual(m.trail, []);
});

test('a strike in the darkness costs as much as a miss, and can end the run', () => {
  resetFloor();
  state.floor.darkness = true;
  state.run.hearts = DARK_MISS_COST;
  const m = minionAt(-1, 0);
  const events = minionStrike(m);
  assert.equal(events[0].cost, DARK_MISS_COST);
  assert.equal(events.at(-1).type, 'signalLost');
});

test('a strike doesn\'t knock a minion onto a tile that is taken', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  const back = { row: m.row - 1, col: m.col };
  m.trail = [back];
  minionAt(-2, 0);
  const events = minionStrike(m);
  assert.deepEqual(events.map(e => e.type), ['minionStruck']);
  assert.equal(m.row, state.floor.playerRow - 1);
});

test('staggerHunter rests the hunter without moving it', () => {
  resetFloor();
  const h = { row: 1, col: 1, kind: 'hunter', rest: 0 };
  assert.deepEqual(staggerHunter(h), [{ type: 'hunterStaggered', hunter: h }]);
  assert.equal(h.rest, HUNTER_REST_TURNS);
  assert.equal(h.row, 1);
});

// --- gun combat in the turn (step 6) ---

test('fire with no target says so', () => {
  resetFloor();
  assert.equal(fireBlock(null), 'noTarget');
});

test('refreshGunTarget picks the best shootable minion and drops a dead one', () => {
  resetFloor();
  const far = minionAt(-3, 0);
  const near = minionAt(-1, 0);
  assert.deepEqual(refreshGunTarget(), [{ type: 'targetPicked', target: near, auto: true }]);
  assert.equal(state.floor.gunTarget, near);
  assert.deepEqual(refreshGunTarget(), [], 'a target that can still be shot stays');
  state.floor.minions = state.floor.minions.filter(m => m !== near);
  refreshGunTarget();
  assert.equal(state.floor.gunTarget, far);
});

test('refreshGunTarget drops a target that can no longer be shot', () => {
  resetFloor();
  const behind = minionAt(2, 0);
  state.floor.gunTarget = behind;
  assert.deepEqual(refreshGunTarget(), []);
  assert.equal(state.floor.gunTarget, null);
});

test('cycleTarget goes round the shootable minions, and says when there are none', () => {
  resetFloor();
  assert.deepEqual(cycleTarget(), [{ type: 'fireBlocked', target: null, reason: 'noTarget' }]);
  const near = minionAt(-1, 0);
  const far = minionAt(-3, 0);
  minionAt(3, 0); // behind the player: out of the light
  assert.equal(cycleTarget()[0].target, near);
  assert.equal(cycleTarget()[0].target, far);
  assert.equal(cycleTarget()[0].target, near);
});

test('with the gun on, a minion that reaches the player strikes instead of engaging', () => {
  resetFloor();
  state.settings.gunCombat = true;
  state.run.turnCount = 0;
  const m = minionAt(-1, 0);
  m.trail = [{ row: m.row - 3, col: m.col }];
  const events = advanceMonsters();
  assert.deepEqual(events.map(e => e.type), ['minionStruck', 'knockedBack']);
  assert.equal(state.run.hearts, MAX_HEARTS - MINION_STRIKE_COST);
  assert.equal(state.battle.selectedTarget, null, 'no battle screen');
  assert.deepEqual(findAdjacentEnemies(), []);
});

test('with the gun on, the hunter still engages and stays on the battle screen', () => {
  resetFloor();
  state.settings.gunCombat = true;
  const hunter = minionAt(-1, 0, null);
  hunter.kind = 'hunter';
  hunter.rest = 0;
  assert.deepEqual(advanceMonsters().map(e => e.type), ['minionEngaged']);
  assert.deepEqual(findAdjacentEnemies(), [hunter]);
});

test('with the gun on, a slow kind moves only every moveEvery turns', () => {
  resetFloor();
  state.settings.gunCombat = true;
  state.run.turnCount = 0;
  const husk = minionAt(-3, 0, 'HUSK');
  const moves = [];
  for (let i = 0; i < 4; i++) {
    moves.push(advanceMonsters().some(e => e.type === 'minionMoved' && e.minion === husk));
  }
  assert.equal(MINION_KINDS.HUSK.moveEvery, 2);
  assert.deepEqual(moves, [false, true, false, true]);
});

test('in classic combat a minion that reaches the player engages, as before', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  assert.deepEqual(advanceMonsters().map(e => e.type), ['minionEngaged']);
  assert.equal(state.battle.selectedTarget, m);
  assert.equal(state.run.hearts, MAX_HEARTS);
});
