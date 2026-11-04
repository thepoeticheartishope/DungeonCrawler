// Unit tests for the light's battery (js/battery.js, light battery plan
// step A): it runs down with the light on and charges with it off, runs
// empty and stays locked off until full, can be switched back on any time
// when switched off by hand, is full on every floor, and is out of play in
// Comfort mode. With the light off only the small circle is lit. The
// stick men's and the dark shots' tests went with combat (dungeon removal
// step C).
//
// Run: node --test tests/*.test.mjs
//
// Same set-up as look.test.mjs: a small open floor on the shared `state`,
// reset before each test.

import { test } from 'node:test';

import assert from 'node:assert/strict';

import { emptyFloor } from './helpers.mjs';

import { state, key, parseKey } from '../js/state.js';

import { LIGHT_BATTERY_MAX, PLAYER_LIGHT_RADIUS } from '../js/config.js';

import { freshLight, lightOn, tickLight, toggleLight, turnsToFull } from '../js/battery.js';

import { computeVisibility, inLookCone, shootBlock } from '../js/sight.js';


// These are the turn game's rules (the start screen's Turns option): One
// stick, the default since one stick plan step G, has its own tests.
state.settings.oneStick = false;

function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: { fogEnabled: true, lightBattery: true, simpleEnemies: false, gaze: true },
    floor: { look: 0 },
  });
}

const types = events => events.map(e => e.type);

test('the light runs down a charge a turn, then dies and locks', () => {
  resetFloor();
  for (let i = 1; i < LIGHT_BATTERY_MAX; i++) {
    assert.deepEqual(tickLight(), []);
    assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX - i);
    assert.ok(lightOn());
  }
  assert.deepEqual(types(tickLight()), ['lightDied']);
  assert.deepEqual(state.floor.light, { on: false, charge: 0, locked: true });
  assert.ok(!lightOn());
});

test('on the ship the battery is out of play: always lit, V does nothing, it never runs down (Timothy 2026-11-01)', () => {
  resetFloor();
  state.floor.ship = true;
  for (let i = 0; i < LIGHT_BATTERY_MAX + 2; i++) tickLight();
  assert.equal(toggleLight(), null);
  assert.equal(lightOn(), true);
  assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX);
  delete state.floor.ship; // the shared floor outlives this test
});

test('run empty, it stays locked off until full, then can come on', () => {
  resetFloor();
  state.floor.light = { on: false, charge: 0, locked: true };
  for (let i = 1; i < LIGHT_BATTERY_MAX; i++) {
    assert.deepEqual(tickLight(), []);
    assert.equal(toggleLight(), 'locked');
    assert.equal(turnsToFull(), LIGHT_BATTERY_MAX - i);
    assert.ok(!state.floor.light.on);
  }
  assert.deepEqual(types(tickLight()), ['lightCharged']);
  assert.equal(state.floor.light.locked, false);
  assert.equal(toggleLight(), 'on');
});

test('switched off by hand with charge left, it charges and comes back on any time', () => {
  resetFloor();
  tickLight();
  tickLight();
  assert.equal(toggleLight(), 'off');
  assert.deepEqual(tickLight(), []);
  assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX - 1);
  assert.equal(toggleLight(), 'on', 'not full, but not locked');
  assert.equal(toggleLight(), 'off');
  tickLight();
  assert.deepEqual(tickLight(), [], 'full again says nothing when it was never locked');
  assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX, 'never past full');
});

test('every floor starts with a full battery and the light on', () => {
  assert.deepEqual(freshLight(), { on: true, charge: LIGHT_BATTERY_MAX, locked: false });
});

test('with the light off only the small circle is lit, and nothing in the cone can be shot', () => {
  resetFloor();
  const ahead = { row: state.floor.playerRow - 3, col: state.floor.playerCol };
  assert.ok(state.floor.sightSet.has(key(ahead.row, ahead.col)));
  toggleLight();
  computeVisibility();
  const far = [...state.floor.sightSet].map(parseKey)
    .filter(({ row, col }) => Math.max(Math.abs(row - state.floor.playerRow), Math.abs(col - state.floor.playerCol)) > PLAYER_LIGHT_RADIUS);
  assert.deepEqual(far, []);
  assert.ok(state.floor.sightSet.has(key(state.floor.playerRow - 1, state.floor.playerCol)));
  assert.ok(!inLookCone(ahead.row, ahead.col));
  assert.equal(shootBlock({ row: state.floor.playerRow - 1, col: state.floor.playerCol }), 'notInLight');
});

test('Comfort mode and DEV -> Light battery off: always on, no battery', () => {
  for (const flip of [() => { state.settings.simpleEnemies = true; }, () => { state.settings.lightBattery = false; }]) {
    resetFloor();
    flip();
    for (let i = 0; i < LIGHT_BATTERY_MAX + 2; i++) assert.deepEqual(tickLight(), []);
    assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX);
    assert.equal(toggleLight(), null);
    assert.ok(lightOn());
    state.floor.light.on = false; // even a light left off before the switch
    assert.ok(lightOn());
  }
});
