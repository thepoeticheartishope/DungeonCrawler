// Unit tests for the d-pad's rules (js/dpad.js): the way each arrow, key
// and number pad key walks (the way it points on screen, room view plan),
// the look stick's taps and holds (light battery plan step D) and its
// sweep (shoulder view plan step B).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCREEN_WAYS, padWay, stickGestures, sweepHold } from '../js/dpad.js';

const EIGHT = ['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'];
const FOUR = ['N', 'E', 'S', 'W'];

test('8 ways: each arrow, key and number pad key walks the way it points on screen', () => {
  // Grid north is up (the room view's camera never turns).
  const expected = { U: 'N', UR: 'NE', R: 'E', DR: 'SE', D: 'S', DL: 'SW', L: 'W', UL: 'NW' };
  for (const [way, [sx, sy]] of Object.entries(SCREEN_WAYS)) assert.equal(padWay(sx, sy, EIGHT), expected[way], way);
  assert.equal(padWay(0, 0, EIGHT), null);
});

test('4 ways: the edges walk, the corners do nothing', () => {
  assert.equal(padWay(0, -1, FOUR), 'N', 'up is grid north');
  assert.equal(padWay(1, 0, FOUR), 'E', 'right is grid east');
  assert.equal(padWay(0, 1, FOUR), 'S');
  assert.equal(padWay(-1, 0, FOUR), 'W');
  assert.equal(padWay(1, -1, FOUR), null);
});

function stick({ armed = false } = {}) {
  const calls = [];
  let clock = 0;
  let due = null;
  const g = stickGestures({
    onWait: () => calls.push('wait'),
    onTurn: () => calls.push('turn'),
    onTap: () => calls.push('tap'),
    onHold: (on) => calls.push(on ? 'ring' : 'unring'),
    wantsTurn: () => armed,
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

test('taps only hint, however many and however quick (the light has its own button)', () => {
  const s = stick();
  s.tapOnce(); s.tapOnce(); s.tapOnce();
  assert.deepEqual(s.actions(), ['tap', 'tap', 'tap']);
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

test('a drag cancels the hold and is no tap', () => {
  const s = stick();
  s.g.press(); s.pass(200); s.g.drag(); s.pass(2000); s.g.release(false);
  assert.deepEqual(s.actions(), []);
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
  s.g.tap();
  assert.deepEqual(s.actions(), ['tap']);
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
