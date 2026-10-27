// Unit tests for the world's beat with One stick (one stick plan step D):
// the boss's light budget and the turns a relay or the gate move it count
// in beats (light.js lightTurnsFor: a turn = ONE_STICK.lightTurnMs), the
// battery runs by time (battery.js drainLight, a charge every
// batteryChargeMs) and not on the beat (tickLight), and Comfort mode's
// sky counts seconds.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { LIGHT_BATTERY_MAX, ONE_STICK, REALTIME_STEP_MS } from '../js/config.js';
import { lightTurnsFor } from '../js/light.js';
import { freshLight, tickLight, drainLight, toggleLight, secondsToFull } from '../js/battery.js';
import { skyTurnsLeft } from '../js/mapshared.js';

function reset(oneStick) {
  state.settings.oneStick = oneStick;
  state.settings.lightBattery = true;
  state.settings.simpleEnemies = false;
  state.floor.tutorial = null;
  state.floor.light = freshLight();
}

test('turns of the light count as beats of lightTurnMs with One stick, as they were without', () => {
  reset(false);
  assert.equal(lightTurnsFor(100), 100);
  reset(true);
  assert.equal(lightTurnsFor(100), Math.ceil(100 * ONE_STICK.lightTurnMs / REALTIME_STEP_MS));
  assert.equal(lightTurnsFor(1), 1, 'a cost is never lost');
  assert.equal(lightTurnsFor(0), 0);
});

test('with One stick the battery runs by time, not on the beat', () => {
  reset(true);
  assert.deepEqual(tickLight(), []);
  assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX, 'the beat leaves it alone');
  const full = LIGHT_BATTERY_MAX * ONE_STICK.batteryChargeMs;
  assert.deepEqual(drainLight(full - 100), []);
  assert.ok(state.floor.light.on);
  assert.deepEqual(drainLight(100).map(e => e.type), ['lightDied']);
  assert.ok(state.floor.light.locked);
  assert.equal(toggleLight(), 'locked');
  assert.equal(secondsToFull(), full / 1000);
  assert.deepEqual(drainLight(full - 100), []);
  assert.deepEqual(drainLight(100).map(e => e.type), ['lightCharged']);
});

test("Comfort mode's sky counts seconds with One stick", () => {
  reset(true);
  state.floor.boss = { row: 0, col: 0 };
  state.floor.lightTurnBudget = 10;
  state.floor.lightTurns = 4;
  assert.equal(skyTurnsLeft(), 6 * REALTIME_STEP_MS / 1000);
  reset(false);
  assert.equal(skyTurnsLeft(), 6);
  state.floor.boss = null;
});
