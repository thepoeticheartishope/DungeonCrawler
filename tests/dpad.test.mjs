// Unit tests for the d-pad's rules (js/dpad.js): the number pad's grid
// steps, the look stick's taps and holds (light battery plan step D), and the arrows' ways round the
// body and the sweep (shoulder view plan step B).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCREEN_WAYS, screenStep, stickGestures, shoulderStep, sweepHold } from '../js/dpad.js';

test('8 ways: each number pad key walks that way on the minimap\'s diamond', () => {
  // Grid north is up and to the right, so up is grid NW.
  const expected = {
    U: [-1, -1], UR: [-1, 0], R: [-1, 1], DR: [0, 1],
    D: [1, 1], DL: [1, 0], L: [1, -1], UL: [0, -1],
  };
  for (const [way, [sx, sy]] of Object.entries(SCREEN_WAYS)) {
    assert.deepEqual(screenStep(sx, sy, true), expected[way], way);
  }
  assert.equal(screenStep(0, 0, true), null);
});

test('4 ways: up is grid north, diagonals do nothing', () => {
  assert.deepEqual(screenStep(0, -1, false), [-1, 0], 'up is grid north');
  assert.deepEqual(screenStep(1, 0, false), [0, 1], 'right is grid east');
  assert.deepEqual(screenStep(0, 1, false), [1, 0]);
  assert.deepEqual(screenStep(-1, 0, false), [0, -1]);
  assert.equal(screenStep(1, -1, false), null);
});

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

// ---- The shoulder view (shoulder view plan step B) ----

const EIGHT = ['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'];
const FOUR = ['N', 'E', 'S', 'W'];

test('shoulder view: up walks ahead, down behind, the upper corners at a slant', () => {
  assert.equal(shoulderStep(0, -1, 'NE', EIGHT), 'NE');
  assert.equal(shoulderStep(0, 1, 'NE', EIGHT), 'SW');
  assert.equal(shoulderStep(-1, -1, 'NE', EIGHT), 'N');
  assert.equal(shoulderStep(1, -1, 'NE', EIGHT), 'E');
  assert.equal(shoulderStep(1, -1, 'NW', EIGHT), 'N', 'round past north');
});

test('shoulder view: left and right sweep and the lower corners do nothing', () => {
  for (const [sx, sy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) assert.equal(shoulderStep(sx, sy, 'N', EIGHT), null);
});

test('shoulder view with 4 ways: the slants are the next grid way round', () => {
  assert.equal(shoulderStep(0, 1, 'E', FOUR), 'W');
  assert.equal(shoulderStep(-1, -1, 'N', FOUR), 'W');
  assert.equal(shoulderStep(1, -1, 'W', FOUR), 'N');
});

// A hand-run frame clock for sweepHold: run(ms) plays frames 10 ms apart.
function frameClock() {
  let queued = null;
  let now = 0;
  return {
    frames: { request: fn => { queued = fn; return 1; }, cancel: () => { queued = null; } },
    run(ms) {
      for (let t = 0; t < ms && queued; t += 10) {
        const fn = queued;
        queued = null;
        fn(now += 10);
      }
    },
    idle: () => queued === null,
  };
}

test('a held sweep goes at its speed until let go', () => {
  const clock = frameClock();
  let swept = 0;
  const hold = sweepHold(d => { swept += d; }, { speed: 1, tapMin: 0.1, frames: clock.frames });
  hold.push('key', 1, true);
  clock.run(510);
  assert.ok(Math.abs(swept - 0.5) < 1e-9, `swept ${swept}`);
  hold.release('key');
  assert.ok(Math.abs(swept - 0.5) < 1e-9, 'a long press sweeps nothing more on release');
  assert.ok(clock.idle());
});

test('a quick tap still sweeps the tap minimum, the way it was pressed', () => {
  const clock = frameClock();
  let swept = 0;
  const hold = sweepHold(d => { swept += d; }, { speed: 1, tapMin: 0.1, frames: clock.frames });
  hold.push('key', -1, true);
  clock.run(30);
  hold.release('key');
  assert.ok(Math.abs(swept + 0.1) < 1e-9, `swept ${swept}`);
});

test('pushes add up, held between -1 and 1, and the stick has no tap minimum', () => {
  const clock = frameClock();
  let swept = 0;
  const hold = sweepHold(d => { swept += d; }, { speed: 1, tapMin: 0.1, frames: clock.frames });
  hold.push('stick', 0.5);
  hold.push('key', 1, true);
  clock.run(110);
  assert.ok(Math.abs(swept - 0.1) < 1e-9, `both together sweep at full speed: ${swept}`);
  hold.release('key');
  hold.push('stick', -0.5);
  hold.push('pad', 0.5);
  swept = 0;
  clock.run(100);
  assert.equal(swept, 0, 'opposite pushes cancel');
  hold.reset();
  assert.ok(clock.idle());
});

test('the sweep speed can be read each frame (Slower sweep)', () => {
  const clock = frameClock();
  let swept = 0;
  let speed = 1;
  const hold = sweepHold(d => { swept += d; }, { speed: () => speed, tapMin: 0, frames: clock.frames });
  hold.push('key', 1);
  clock.run(110);
  speed = 0.5;
  clock.run(100);
  assert.ok(Math.abs(swept - 0.15) < 1e-9, `swept ${swept}`);
  hold.reset();
});
