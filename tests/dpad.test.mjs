// Unit tests for the d-pad's rules (js/dpad.js, eight ways plan step B):
// which grid step each screen way walks, with 8 ways and with 4, and the
// arrow keys' chord (two arrows together walk a diagonal).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCREEN_WAYS, screenStep, arrowChord } from '../js/dpad.js';

test('8 ways: each arrow walks that way on screen', () => {
  // Grid north is up and to the right on screen, so screen up is grid NW.
  const expected = {
    U: [-1, -1], UR: [-1, 0], R: [-1, 1], DR: [0, 1],
    D: [1, 1], DL: [1, 0], L: [1, -1], UL: [0, -1],
  };
  for (const [way, [sx, sy]] of Object.entries(SCREEN_WAYS)) {
    assert.deepEqual(screenStep(sx, sy, true), expected[way], way);
  }
  assert.equal(screenStep(0, 0, true), null);
});

test('4 ways: the turned pad and the keys walk as before, diagonals do nothing', () => {
  assert.deepEqual(screenStep(0, -1, false), [-1, 0], 'up is grid north');
  assert.deepEqual(screenStep(1, 0, false), [0, 1], 'right is grid east');
  assert.deepEqual(screenStep(0, 1, false), [1, 0]);
  assert.deepEqual(screenStep(-1, 0, false), [0, -1]);
  assert.equal(screenStep(1, -1, false), null);
});

// A chord with a hand-run timer: `flush()` plays the wait out.
function chord() {
  const steps = [];
  let due = null;
  const timers = { set: (fn) => { due = fn; return 1; }, clear: () => { due = null; } };
  const c = arrowChord((sx, sy) => steps.push([sx, sy]), 60, timers);
  const flush = () => { const fn = due; due = null; if (fn) fn(); };
  return { c, steps, flush, waiting: () => due !== null };
}

test('one arrow steps once the wait is over', () => {
  const { c, steps, flush } = chord();
  c.down('U', false);
  assert.deepEqual(steps, [], 'waits for a second arrow');
  flush();
  assert.deepEqual(steps, [[0, -1]]);
});

test('two arrows together step the diagonal at once', () => {
  const { c, steps, waiting } = chord();
  c.down('U', false);
  c.down('R', false);
  assert.deepEqual(steps, [[1, -1]]);
  assert.equal(waiting(), false);
});

test('a pair released inside the wait still steps the diagonal', () => {
  const { c, steps, flush } = chord();
  c.down('L', false);
  c.up('L');
  c.down('D', false);
  c.up('D');
  assert.deepEqual(steps, [[-1, 1]]);
  flush();
  assert.deepEqual(steps, [[-1, 1]], 'and only once');
});

test('a single arrow released inside the wait still steps', () => {
  const { c, steps, flush } = chord();
  c.down('D', false);
  c.up('D');
  flush();
  assert.deepEqual(steps, [[0, 1]]);
});

test('held arrows repeat the held combination; opposites cancel', () => {
  const { c, steps, flush } = chord();
  c.down('U', false);
  flush();
  c.down('L', false);
  flush();
  assert.deepEqual(steps.at(-1), [-1, -1], 'a second arrow joins the one held');
  c.down('L', true);
  assert.deepEqual(steps.at(-1), [-1, -1], 'a repeat walks what is held');
  c.up('U');
  c.down('L', true);
  assert.deepEqual(steps.at(-1), [-1, 0]);
  const before = steps.length;
  c.reset();
  c.down('U', false);
  c.down('D', false);
  assert.equal(steps.length, before, 'up with down goes nowhere');
});
