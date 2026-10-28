// Unit tests for downed stick men (downed plan step A; kill or maim plan:
// a shot in the dial's maim zone knocks one down); down, it moves half as often, never takes a
// duct, grabs the player's ankle instead of striking, and a bump finishes
// it for no energy.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor, gunRun, minionAt as placeMinion } from './helpers.mjs';
import { state } from '../js/state.js';
import { MAX_HEARTS, MINION_KINDS, DOWNED_SLOWDOWN } from '../js/config.js';
import { advanceMonsters, movesEvery } from '../js/combat.js';
import { stepPlayer } from '../js/moves.js';
import { fitsVents } from '../js/vents.js';
import { fire, readyShot, settleShot } from '../js/gun.js';

// An open floor, player in the middle facing north, the gun on, Downed on,
// one round of energy.
function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: { freeLook: false, fogEnabled: true, gunCombat: true, downed: true, noise: true, simpleEnemies: false },
    run: gunRun(1),
  });
}

// Every stick man here hunts, so the chase and reach rules run.
const minionAt = (dr, dc, kind) => placeMinion(dr, dc, kind, { hunts: true });

// A downed stick man, as a maim leaves it, with its stun spent.
function downedAt(dr, dc, kind = 'SHARD') {
  const m = minionAt(dr, dc, kind);
  m.downed = true;
  return m;
}

// Fires at `m`, presses READY and stops the dial in the middle of its
// first `tier` zone.
function shoot(m, tier) {
  const real = Math.random;
  Math.random = () => 0;
  try { fire(m); } finally { Math.random = real; }
  readyShot();
  const zone = state.battle.aim.zones.find(z => z.tier === tier);
  return settleShot((zone.from + zone.to) / 2);
}
const types = events => events.map(e => e.type);
const movedThisTurn = m => advanceMonsters().some(e => e.type === 'minionMoved' && e.minion === m);

test('a maim knocks a stick man down, stunned as before', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  assert.deepEqual(types(shoot(m, 'maim')), ['minionHit', 'minionDowned']);
  assert.equal(m.downed, true);
  assert.ok(m.rest > 0, 'the fall takes its next move');
  assert.ok(state.floor.minions.includes(m));
});

test('a kill kills it standing; a guarded HUSK only loses its guard', () => {
  resetFloor();
  const shard = minionAt(-1, 0);
  assert.deepEqual(types(shoot(shard, 'kill')), ['minionHit', 'minionKilled', 'goldGained']);
  assert.equal(shard.downed, false);

  state.run.energy = 1;
  state.run.rounds = [null];
  const husk = minionAt(-1, 0, 'HUSK');
  assert.deepEqual(types(shoot(husk, 'maim')), ['minionHit', 'guardBroken']);
  assert.equal(husk.downed, false);
});

test('a shot finishes a downed one too, kill or maim', () => {
  resetFloor();
  const m = downedAt(-1, 0);
  assert.deepEqual(types(shoot(m, 'maim')), ['minionHit', 'minionFinished', 'minionKilled', 'goldGained']);
  assert.deepEqual(state.floor.minions, []);
});

test('with DEV -> Downed off, a maim only makes it reel', () => {
  resetFloor();
  state.settings.downed = false;
  const m = minionAt(-1, 0);
  assert.deepEqual(types(shoot(m, 'maim')), ['minionHit', 'minionReels']);
  assert.equal(m.downed, false);
  assert.ok(m.rest > 0);
});

test('a downed SHARD moves every 2nd turn and a downed HUSK every 4th', () => {
  resetFloor();
  assert.equal(DOWNED_SLOWDOWN, 2);
  const shard = downedAt(-8, 0);
  assert.equal(movesEvery(shard), MINION_KINDS.SHARD.moveEvery * 2);
  assert.deepEqual([1, 2, 3, 4].map(() => movedThisTurn(shard)), [false, true, false, true]);

  resetFloor();
  const husk = downedAt(-8, 0, 'HUSK');
  assert.equal(movesEvery(husk), 4);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(() => movedThisTurn(husk)), [false, false, false, true, false, false, false, true]);
});

test('"I see you." waits for a downed one\'s real move', () => {
  // Behind the player, three steps away: it crawls to two steps on turn 2.
  resetFloor();
  state.run.turnCount = 1;
  const m = downedAt(3, 0);
  const first = advanceMonsters();
  assert.ok(first.some(e => e.type === 'minionMoved' && e.minion === m));
  assert.ok(!first.some(e => e.type === 'presenceSensed'), 'its next move is two turns off');
  assert.ok(advanceMonsters().some(e => e.type === 'presenceSensed' && e.minion === m), 'warned the turn before it moves');

  // Standing, the same stick man is warned of at once.
  resetFloor();
  state.run.turnCount = 1;
  minionAt(3, 0);
  assert.ok(advanceMonsters().some(e => e.type === 'presenceSensed'));
});

test('a downed one never takes a duct', () => {
  resetFloor();
  const m = minionAt(-3, 0);
  assert.equal(fitsVents(m), true);
  m.downed = true;
  assert.equal(fitsVents(m), false);
});

test('reaching the player it grabs their ankle: no stability lost, no Struggle with no energy', () => {
  resetFloor();
  state.run.energy = 0;
  state.run.rounds = [];
  state.run.turnCount = 1;
  const m = downedAt(-1, 0);
  const at = { row: m.row, col: m.col };
  assert.deepEqual(types(advanceMonsters()), ['ankleGrabbed']);
  assert.equal(m.grabbing, true);
  assert.equal(state.run.hearts, MAX_HEARTS);
  assert.equal(state.battle.struggle, null);
  // It holds on where it is, turn after turn, and grabs only once.
  for (let i = 0; i < 4; i++) assert.deepEqual(advanceMonsters().filter(e => e.minion === m), []);
  assert.deepEqual({ row: m.row, col: m.col }, at);
  assert.equal(state.run.hearts, MAX_HEARTS);
});

test('held, a step away is refused with no turn spent, but the player still turns', () => {
  resetFloor();
  const m = downedAt(-1, 0);
  m.grabbing = true;
  const from = { row: state.floor.playerRow, col: state.floor.playerCol };
  const events = stepPlayer(1, 0);
  assert.deepEqual(types(events), ['turned', 'heldFast']);
  assert.equal(events[1].minion, m);
  assert.equal(state.floor.facing, 'S');
  assert.deepEqual({ row: state.floor.playerRow, col: state.floor.playerCol }, from);
});

test('walking into a downed one finishes it and pays its gold; it lets go', () => {
  resetFloor();
  const m = downedAt(-1, 0, 'STALKER');
  m.grabbing = true;
  const events = stepPlayer(-1, 0);
  assert.deepEqual(types(events), ['minionFinished', 'minionKilled', 'goldGained']);
  assert.equal(events[2].amount, MINION_KINDS.STALKER.gold);
  assert.equal(state.run.coinsTotal, MINION_KINDS.STALKER.gold);
  assert.equal(state.run.energy, 1, 'no energy spent');
  assert.deepEqual(state.floor.minions, []);
  assert.deepEqual(types(stepPlayer(1, 0)), ['turned', 'stepped'], 'free to walk away');
});

test('walking into a standing one is still just blocked', () => {
  resetFloor();
  const m = minionAt(-1, 0);
  assert.deepEqual(types(stepPlayer(-1, 0)), ['blocked']);
  assert.ok(state.floor.minions.includes(m));
});
