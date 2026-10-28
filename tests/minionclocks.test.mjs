// Unit tests for the stick men's own clocks (combat.js clockFrame, one
// stick plan step C): idle they step every ONE_STICK.wanderMs, chasing
// every chaseMs, a HUSK at its moveEvery times that; next to the player
// one reaches for reachMs first, and its reach lands only if the player
// is still within ONE_STICK.reach, else "It misses.".
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor, gunRun } from './helpers.mjs';
import { state } from '../js/state.js';
import { MAX_HEARTS, MINION_KINDS, ONE_STICK } from '../js/config.js';
import { spawnMinion, clockFrame } from '../js/combat.js';

const FRAME = 10;

// An open floor, player in the middle facing north, the gun on, One stick
// on, energy left (so a landed reach strikes, no Struggle).
function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: { oneStick: true, fogEnabled: true, gunCombat: true, downed: true, noise: true, simpleEnemies: false },
    run: gunRun(1),
  });
}

// A stick man `dr`, `dc` tiles from the player that always comes for them.
function hunterAt(dr, dc, kind = 'SHARD') {
  const m = spawnMinion({ row: state.floor.playerRow + dr, col: state.floor.playerCol + dc }, kind);
  m.hunts = true;
  return m;
}

// Runs the clocks for `ms`, a frame at a time. Returns every event.
function run(ms) {
  const events = [];
  for (let t = 0; t < ms; t += FRAME) events.push(...clockFrame(FRAME));
  return events;
}
const steps = (events, m) => events.filter(e => e.type === 'minionMoved' && e.minion === m);

test('an idle stick man steps every wanderMs, a chasing one every chaseMs', () => {
  resetFloor();
  const idle = spawnMinion({ row: 1, col: 1 }, 'SHARD');
  const chaser = hunterAt(-8, 0);
  const events = run(ONE_STICK.wanderMs * 2 + FRAME);
  assert.equal(steps(events, idle).length, 2, 'two wandering steps');
  // The first wait is a wandering one; then a chase step every chaseMs.
  const chased = 1 + Math.floor((ONE_STICK.wanderMs * 2 + FRAME - ONE_STICK.wanderMs) / ONE_STICK.chaseMs);
  assert.equal(steps(events, chaser).length, chased);
  assert.equal(steps(events, chaser)[1].ms, ONE_STICK.chaseMs, 'its slide takes its pace');
});

test('a HUSK takes its moveEvery times as long', () => {
  resetFloor();
  const husk = hunterAt(-8, 0, 'HUSK');
  const every = MINION_KINDS.HUSK.moveEvery;
  const events = run(ONE_STICK.wanderMs * every + ONE_STICK.chaseMs * every * 2 + FRAME);
  assert.equal(steps(events, husk).length, 3);
});

test('next to the player it reaches first, and the reach lands', () => {
  resetFloor();
  const m = hunterAt(-1, 0);
  let events = run(ONE_STICK.wanderMs);
  assert.ok(events.some(e => e.type === 'reachStarted' && e.minion === m));
  assert.equal(state.run.hearts, MAX_HEARTS, 'no strike yet');
  events = run(ONE_STICK.reachMs);
  assert.ok(events.some(e => e.type === 'minionStruck'), 'the reach lands');
  assert.ok(state.run.hearts < MAX_HEARTS);
});

test('a reach misses once the player has stepped out of reach', () => {
  resetFloor();
  const m = hunterAt(-1, 0);
  run(ONE_STICK.wanderMs);
  assert.ok(m.reaching);
  state.floor.playerRow += 1;
  state.floor.playerAt = { x: state.floor.playerCol + 0.5, y: state.floor.playerRow + 0.9 };
  const events = run(ONE_STICK.reachMs);
  assert.ok(events.some(e => e.type === 'reachMissed' && e.minion === m));
  assert.equal(state.run.hearts, MAX_HEARTS);
});

test('a guarded HUSK reaches for reachGuardMs', () => {
  resetFloor();
  const m = hunterAt(-1, 0, 'HUSK');
  run(ONE_STICK.wanderMs * MINION_KINDS.HUSK.moveEvery);
  assert.ok(m.reaching);
  assert.ok(!run(ONE_STICK.reachMs).some(e => e.type === 'minionStruck'), 'not after reachMs');
  assert.ok(run(ONE_STICK.reachGuardMs - ONE_STICK.reachMs).some(e => e.type === 'minionStruck'));
});
