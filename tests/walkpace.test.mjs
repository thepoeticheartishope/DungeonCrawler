// Unit tests for smooth walk (js/walkpace.js): every way moves at the
// same speed on screen, a held way waits for its step to land, and
// DEV -> Smooth walk off keeps one step time for all.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { MAP_ANIMATION_MS, DPAD_HOLD_REPEAT_MS, WALK_REPEAT_GAP_MS } from '../js/config.js';
import { stepMs, repeatMs, noteStep, heldStepReady } from '../js/walkpace.js';

// Every grid way, with its screen length in tile widths (the old isometric
// map's isoScreenOffset: x = (dc - dr) / 2, y = (dc + dr) / 4).
const WAYS = [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
const screenLength = ([dr, dc]) => Math.hypot((dc - dr) / 2, (dc + dr) / 4);

test('smooth walk: all eight ways move at the same speed on screen', () => {
  state.settings.smoothWalk = true;
  const speeds = WAYS.map(way => screenLength(way) / stepMs(...way));
  speeds.forEach(speed => assert.ok(Math.abs(speed - speeds[0]) / speeds[0] < 0.01, String(speeds)));
});

test('smooth walk: grid steps keep their old time; ← → are longer, ↑ ↓ a little shorter', () => {
  state.settings.smoothWalk = true;
  assert.equal(stepMs(-1, 0), MAP_ANIMATION_MS.step);
  assert.equal(repeatMs(-1, 0), DPAD_HOLD_REPEAT_MS);
  assert.ok(stepMs(-1, 1) > MAP_ANIMATION_MS.step * 1.7); // → (grid NE): a whole tile across
  assert.ok(stepMs(-1, -1) < MAP_ANIMATION_MS.step);      // ↑ (grid NW): half a tile up
  WAYS.forEach(way => assert.equal(repeatMs(...way), stepMs(...way) + WALK_REPEAT_GAP_MS));
});

test('smooth walk off: one step time and repeat for every way', () => {
  state.settings.smoothWalk = false;
  WAYS.forEach(way => {
    assert.equal(stepMs(...way), MAP_ANIMATION_MS.step);
    assert.equal(repeatMs(...way), DPAD_HOLD_REPEAT_MS);
  });
  noteStep(-1, 1, 1000);
  assert.equal(heldStepReady(1001), true);
  state.settings.smoothWalk = true;
});

test('a held key steps again only once the last step has landed', () => {
  state.settings.smoothWalk = true;
  noteStep(-1, 1, 1000); // → : the longest step
  assert.equal(heldStepReady(1000 + repeatMs(-1, 1) - 1), false);
  assert.equal(heldStepReady(1000 + repeatMs(-1, 1)), true);
  noteStep(-1, 0, 5000); // a grid step waits less
  assert.equal(heldStepReady(5000 + DPAD_HOLD_REPEAT_MS), true);
});
