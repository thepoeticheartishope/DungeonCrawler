// Unit tests for the dial's pure helpers (js/dialview.js, kill or maim
// plan step B): where a stop lands in the zones' own frame, the surge's
// speed curve, and the marker's lap counting with turn-backs.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIAL_DRIFT_LAPS, DIAL_SURGE_AT, DIAL_SURGE_BOOST, DIAL_TURN_PAUSE_MS, DIAL_TURN_PAUSE_REDUCED_MS,
} from '../js/config.js';
import { zoneFrame, surgeSpeed, newMarker, stepMarker, lapsUp } from '../js/dialview.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a stop lands in the zones\' frame: the drift is taken off and it wraps round', () => {
  assert.ok(near(zoneFrame(0.5, 0), 0.5));
  assert.ok(near(zoneFrame(0.5, 0.2), 0.3));
  assert.ok(near(zoneFrame(0.1, 0.3), 0.8));
  assert.ok(near(zoneFrame(0.95, 0.95), 0));
});

test('the surge is fastest at its side, even a quarter round, and off when the kind has none', () => {
  assert.ok(near(surgeSpeed(DIAL_SURGE_AT, true), 1 + DIAL_SURGE_BOOST));
  assert.ok(near(surgeSpeed(DIAL_SURGE_AT + 0.25, true), 1));
  assert.ok(near(surgeSpeed(DIAL_SURGE_AT - 0.5, true), 1));
  assert.ok(surgeSpeed(DIAL_SURGE_AT + 0.1, true) > 1);
  assert.equal(surgeSpeed(DIAL_SURGE_AT, false), 1);
});

test('a plain marker goes once round in a lap, clockwise, and the lap limit stops it', () => {
  const m = { at: 0.25, drift: 0, dir: 1, laps: 0, pause: 0, nextTurn: 1000 };
  for (let i = 0; i < 100; i++) stepMarker(m, 20, { lapMs: 2000 });
  assert.ok(near(m.at, 0.25));
  assert.ok(near(m.laps, 1));
  assert.equal(m.drift, 0);
  assert.equal(lapsUp(m, 0), false);
  assert.equal(lapsUp(m, 1), true);
  assert.equal(lapsUp(m, 3), false);
});

test('a surging marker gets round sooner', () => {
  const plain = { at: DIAL_SURGE_AT - 0.1, drift: 0, dir: 1, laps: 0, pause: 0, nextTurn: 0 };
  const surging = { ...plain };
  for (let i = 0; i < 50; i++) {
    stepMarker(plain, 20, { lapMs: 2000 });
    stepMarker(surging, 20, { lapMs: 2000, traits: { surge: true } });
  }
  assert.ok(surging.laps > plain.laps);
});

test('the zones drift with the marker on a HUSK, not under reduced motion', () => {
  const m = { at: 0, drift: 0, dir: 1, laps: 0, pause: 0, nextTurn: 0 };
  stepMarker(m, 1000, { lapMs: 2000, traits: { spin: 'with' } });
  assert.ok(near(m.drift, DIAL_DRIFT_LAPS));
  const still = { at: 0, drift: 0, dir: 1, laps: 0, pause: 0, nextTurn: 0 };
  stepMarker(still, 1000, { lapMs: 2000, traits: { spin: 'with' }, reduced: true });
  assert.equal(still.drift, 0);
});

test('a turning marker pauses (the tell), then goes back, and its laps still count up', () => {
  const m = { at: 0.5, drift: 0, dir: 1, laps: 0, pause: 0, nextTurn: 100 };
  const opts = { lapMs: 2000, traits: { turnBack: true }, random: () => 0 };
  for (let i = 0; i < 5; i++) stepMarker(m, 20, opts);
  assert.equal(m.pause, DIAL_TURN_PAUSE_MS);
  const where = m.at;
  const laps = m.laps;
  stepMarker(m, 20, opts);
  assert.equal(m.at, where, 'still while it pauses');
  assert.equal(m.laps, laps);
  for (let i = 0; i < 20 && m.pause > 0; i++) stepMarker(m, 20, opts);
  assert.equal(m.dir, -1);
  stepMarker(m, 20, opts);
  assert.ok(m.at < where, 'going back the other way');
  assert.ok(m.laps > laps, 'going back counts toward the lap limit too');

  const slow = { at: 0.5, drift: 0, dir: 1, laps: 0, pause: 0, nextTurn: 10 };
  stepMarker(slow, 20, { ...opts, reduced: true });
  assert.equal(slow.pause, DIAL_TURN_PAUSE_REDUCED_MS);
});

test('a kind with no turn-back never turns', () => {
  const m = { at: 0, drift: 0, dir: 1, laps: 0, pause: 0, nextTurn: 0 };
  for (let i = 0; i < 500; i++) stepMarker(m, 20, { lapMs: 1100 });
  assert.equal(m.dir, 1);
  assert.equal(m.pause, 0);
});

test('a new marker starts somewhere on the circle, going clockwise, at no laps', () => {
  const m = newMarker(() => 0.4);
  assert.equal(m.at, 0.4);
  assert.equal(m.dir, 1);
  assert.equal(m.laps, 0);
  assert.ok(m.nextTurn > 0);
});
