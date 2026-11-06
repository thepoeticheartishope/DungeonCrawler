// Unit tests for smooth walk (js/walkpace.js): every way moves at the
// same speed on screen.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAP_ANIMATION_MS } from '../js/config.js';
import { stepMs } from '../js/walkpace.js';

// Every grid way, with its screen length in tile widths (the old isometric
// map's isoScreenOffset: x = (dc - dr) / 2, y = (dc + dr) / 4).
const WAYS = [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
const screenLength = ([dr, dc]) => Math.hypot((dc - dr) / 2, (dc + dr) / 4);

test('smooth walk: all eight ways move at the same speed on screen', () => {
  const speeds = WAYS.map(way => screenLength(way) / stepMs(...way));
  speeds.forEach(speed => assert.ok(Math.abs(speed - speeds[0]) / speeds[0] < 0.01, String(speeds)));
});

test('smooth walk: grid steps keep their old time; ← → are longer, ↑ ↓ a little shorter', () => {
  assert.equal(stepMs(-1, 0), MAP_ANIMATION_MS.step);
  assert.ok(stepMs(-1, 1) > MAP_ANIMATION_MS.step * 1.7); // → (grid NE): a whole tile across
  assert.ok(stepMs(-1, -1) < MAP_ANIMATION_MS.step);      // ↑ (grid NW): half a tile up
});
