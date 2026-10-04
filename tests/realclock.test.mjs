// Unit tests for the real-time clock (realclock.js pollClock / resetClock):
// a tick every REALTIME_STEP_MS of running time, paused time never counts,
// the NEXT meter (clockReading) turns direction at each tick,
// and a stalled page can't fire ticks back to back.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REALTIME_STEP_MS, REALTIME_POLL_MS } from '../js/config.js';
import { pollClock, resetClock, clockReading } from '../js/realclock.js';

// Polls every REALTIME_POLL_MS from `start` for `ms`, all running or all
// paused. Returns how many ticks came and the time it ended at.
function run(start, ms, running) {
  let ticks = 0;
  let now = start;
  for (; now < start + ms; now += REALTIME_POLL_MS) {
    if (pollClock(now, running)) ticks++;
  }
  return { ticks, now };
}

test('the clock ticks once every REALTIME_STEP_MS while it runs', () => {
  resetClock();
  pollClock(0, true);
  const { ticks } = run(REALTIME_POLL_MS, REALTIME_STEP_MS * 4, true);
  assert.equal(ticks, 4);
});

test('time while paused never counts toward the next tick', () => {
  resetClock();
  const { now } = run(0, REALTIME_STEP_MS - REALTIME_POLL_MS * 3, true);
  const paused = run(now, REALTIME_STEP_MS * 3, false);
  assert.equal(paused.ticks, 0);
  // Back to running: the tick comes after the rest of the step, not at once.
  assert.equal(pollClock(paused.now, true), false);
  const rest = run(paused.now + REALTIME_POLL_MS, REALTIME_POLL_MS * 2, true);
  assert.equal(rest.ticks, 0);
  assert.equal(pollClock(rest.now, true), true);
});

test('a long stall counts as one poll at most, so ticks never pile up', () => {
  resetClock();
  pollClock(0, true);
  assert.equal(pollClock(REALTIME_STEP_MS * 10, true), false);
});

test('resetClock gives a new floor the full step before the world moves', () => {
  resetClock();
  const { now } = run(0, REALTIME_STEP_MS - REALTIME_POLL_MS, true);
  resetClock();
  const after = run(now, REALTIME_STEP_MS - REALTIME_POLL_MS * 2, true);
  assert.equal(after.ticks, 0);
});

test('the NEXT meter fills one step and empties the next, never jumping', () => {
  resetClock();
  pollClock(0, true);
  assert.deepEqual(clockReading(), { share: 0, filling: true });
  const first = run(REALTIME_POLL_MS, REALTIME_STEP_MS, true);
  assert.equal(first.ticks, 1);
  assert.equal(clockReading().filling, false);
  run(first.now, REALTIME_STEP_MS, true);
  assert.equal(clockReading().filling, true);
});
