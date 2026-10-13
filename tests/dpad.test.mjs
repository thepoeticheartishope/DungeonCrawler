// Unit tests for the d-pad's rules (js/dpad.js, eight ways plan step B):
// which grid step each screen way walks, with 8 ways and with 4, and the
// arrow keys' chord (two arrows together walk a diagonal), and the look
// stick's taps and holds (light battery plan step D).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCREEN_WAYS, screenStep, arrowChord, stickGestures } from '../js/dpad.js';

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

// --- The look stick's taps and holds (dpad.js stickGestures, light
// battery plan step D), on a hand-run clock ---

function stick({ armed = false } = {}) {
  const calls = [];
  let clock = 0;
  let due = null;
  const g = stickGestures({
    onWait: () => calls.push('wait'),
    onLight: () => calls.push('light'),
    onTurn: () => calls.push('turn'),
    onCount: (n) => calls.push('count' + n),
    onHold: (on) => calls.push(on ? 'ring' : 'unring'),
    wantsTurn: () => armed,
    holdMs: 1000, tapMs: 450,
    timers: { set: (fn, ms) => { due = { fn, at: clock + ms }; return 1; }, clear: () => { due = null; } },
    now: () => clock,
  });
  const pass = (ms) => {
    clock += ms;
    if (due && clock >= due.at) { const { fn } = due; due = null; fn(); }
  };
  const tapOnce = (gap = 100) => { pass(gap); g.press(); pass(80); g.release(); };
  return { g, calls, pass, tapOnce, actions: () => calls.filter(c => c !== 'ring' && c !== 'unring') };
}

test('3 quick taps switch the light; the first two only count', () => {
  const s = stick();
  s.tapOnce(); s.tapOnce(); s.tapOnce();
  assert.deepEqual(s.actions(), ['count1', 'count2', 'light']);
});

test('2 taps, then a pause: the count starts again', () => {
  const s = stick();
  s.tapOnce(); s.tapOnce();
  s.tapOnce(1000);
  assert.deepEqual(s.actions(), ['count1', 'count2', 'count1']);
});

test('a press held 1 s waits, shows its ring, and its release is no tap', () => {
  const s = stick();
  s.g.press();
  s.pass(999);
  assert.deepEqual(s.calls, ['ring']);
  s.pass(1);
  assert.deepEqual(s.calls, ['ring', 'unring', 'wait']);
  s.g.release();
  assert.deepEqual(s.actions(), ['wait']);
});

test('a hold after 2 taps waits and drops the count', () => {
  const s = stick();
  s.tapOnce(); s.tapOnce();
  s.g.press(); s.pass(1000); s.g.release();
  s.tapOnce();
  assert.deepEqual(s.actions(), ['count1', 'count2', 'wait', 'count1']);
});

test('a drag cancels the hold and the count', () => {
  const s = stick();
  s.tapOnce(); s.tapOnce();
  s.g.press(); s.pass(200); s.g.drag(); s.pass(2000); s.g.release(false);
  s.tapOnce();
  assert.deepEqual(s.actions(), ['count1', 'count2', 'count1']);
  assert.equal(s.calls.filter(c => c === 'ring').length, s.calls.filter(c => c === 'unring').length, 'every ring cleared');
});

test('aimed past the arc, one tap turns; a hold still waits', () => {
  const s = stick({ armed: true });
  s.tapOnce();
  s.g.press(); s.pass(1000); s.g.release();
  assert.deepEqual(s.actions(), ['turn', 'wait']);
});

test('Enter on the focused stick taps', () => {
  const s = stick();
  s.g.tap(); s.g.tap(); s.g.tap();
  assert.deepEqual(s.actions(), ['count1', 'count2', 'light']);
});
