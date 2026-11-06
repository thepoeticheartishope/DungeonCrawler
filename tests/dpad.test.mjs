// Unit tests for the walk stick's taps and holds (js/dpad.js
// stickGestures): a tap hints, a still press held looks up, a drag
// cancels the hold.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stickGestures } from '../js/dpad.js';

function stick() {
  const calls = [];
  let clock = 0;
  let due = null;
  const g = stickGestures({
    onWait: () => calls.push('wait'),
    onTap: () => calls.push('tap'),
    onHold: (on) => calls.push(on ? 'ring' : 'unring'),
    holdMs: 1000,
    timers: { set: (fn, ms) => { due = { fn, at: clock + ms }; return 1; }, clear: () => { due = null; } },
  });
  const pass = (ms) => {
    clock += ms;
    if (due && clock >= due.at) { const { fn } = due; due = null; fn(); }
  };
  const tapOnce = (gap = 100) => { pass(gap); g.press(); pass(80); g.release(); };
  return { g, calls, pass, tapOnce, actions: () => calls.filter(c => c !== 'ring' && c !== 'unring') };
}

test('taps only hint, however many and however quick', () => {
  const s = stick();
  s.tapOnce(); s.tapOnce(); s.tapOnce();
  assert.deepEqual(s.actions(), ['tap', 'tap', 'tap']);
});

test('a press held 1 s looks up (onWait), shows its ring, and its release is no tap', () => {
  const s = stick();
  s.g.press();
  s.pass(999);
  assert.deepEqual(s.calls, ['ring']);
  s.pass(1);
  assert.deepEqual(s.calls, ['ring', 'unring', 'wait']);
  s.g.release();
  assert.deepEqual(s.actions(), ['wait']);
});

test('a drag cancels the hold and is no tap', () => {
  const s = stick();
  s.g.press(); s.pass(200); s.g.drag(); s.pass(2000); s.g.release(false);
  assert.deepEqual(s.actions(), []);
  assert.equal(s.calls.filter(c => c === 'ring').length, s.calls.filter(c => c === 'unring').length, 'every ring cleared');
});

test('Enter on the focused stick taps', () => {
  const s = stick();
  s.g.tap();
  assert.deepEqual(s.actions(), ['tap']);
});
