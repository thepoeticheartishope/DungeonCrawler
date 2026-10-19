// Unit tests for the player's stick man as a body (js/playerform.js,
// player figure plan step A): a step puts one foot ahead and the other
// behind and the legs take turns; every step's length stays inside its
// bounds; the first step after standing is shorter; a stop gathers the
// feet together; a bump is a half step; the same steps come out the same
// every time (seeded, never Math.random); a shot waiting keeps the head
// still; reduced motion stands him still. The ember head's glow breathes
// with him (step B).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER_WALK, PLAYER_EMBER, MAP_ANIMATION_MS } from '../js/config.js';
import { playerStepped, playerBumped, playerActive, playerPose, feetAt, resetPlayerForm, emberGlow } from '../js/playerform.js';

const STEP_MS = 140;

// Walks `n` steps one after another from `start`, each starting as the
// last one's slide ends; returns the time after the last.
function walk(n, start = 10000) {
  let now = start;
  for (let i = 0; i < n; i++) {
    playerStepped(now, STEP_MS);
    now += STEP_MS;
  }
  return now;
}

// Plays frames every 16 ms from `from` to `to`, as the view would.
function frames(from, to, still = false, steady = false) {
  let pose = null;
  for (let now = from; now <= to; now += 16) pose = playerPose(now, still, steady);
  return pose;
}

test('a step ends with one foot ahead and the other behind, and the legs take turns', () => {
  resetPlayerForm();
  let now = 10000;
  const leads = [];
  for (let i = 0; i < 6; i++) {
    playerStepped(now, STEP_MS);
    now += STEP_MS * 2; // past the step's own time, before the feet gather
    const { along } = feetAt(now);
    assert.ok(Math.max(...along) > 0 && Math.min(...along) < 0, `step ${i}: ${along}`);
    leads.push(along[0] > along[1] ? 0 : 1);
    now -= STEP_MS * 0.5;
  }
  leads.forEach((lead, i) => { if (i) assert.notEqual(lead, leads[i - 1], 'the other foot leads each step'); });
});

test('every step\'s length stays inside its bounds', () => {
  resetPlayerForm();
  let now = walk(1);
  for (let i = 0; i < 40; i++) {
    playerStepped(now, STEP_MS);
    now += STEP_MS * 2;
    const lead = Math.max(...feetAt(now).along);
    assert.ok(lead >= PLAYER_WALK.stride * PLAYER_WALK.strideRange[0] * PLAYER_WALK.firstScale - 1e-9, `${lead} too short`);
    assert.ok(lead <= PLAYER_WALK.stride * PLAYER_WALK.strideRange[1] + 1e-9, `${lead} too long`);
    now -= STEP_MS * 0.5;
  }
});

test('the first step after standing is shorter and slower than a step while walking', () => {
  resetPlayerForm();
  playerStepped(10000, STEP_MS);
  const first = Math.max(...feetAt(10000 + STEP_MS * 3).along);
  // Walking on (no rest), the same seed slot's step is full length.
  resetPlayerForm();
  const now = walk(1);
  playerStepped(now, STEP_MS);
  const walking = Math.max(...feetAt(now + STEP_MS * 3).along);
  assert.ok(first < walking * 0.8, `first ${first}, walking ${walking}`);
});

test('a stop gathers the feet together under him', () => {
  resetPlayerForm();
  const end = walk(3);
  frames(end, end + PLAYER_WALK.gatherWaitMs + PLAYER_WALK.gatherMs + 200);
  const { along } = feetAt(end + PLAYER_WALK.gatherWaitMs + PLAYER_WALK.gatherMs + 200);
  assert.ok(Math.abs(along[0]) < 1e-9 && Math.abs(along[1]) < 1e-9, `${along}`);
});

test('a bump is a half step', () => {
  resetPlayerForm();
  const now = walk(2);
  playerBumped(now + 5000, MAP_ANIMATION_MS.bump);
  const half = Math.max(...feetAt(now + 5000 + MAP_ANIMATION_MS.bump * 2).along);
  assert.ok(half <= PLAYER_WALK.stride * PLAYER_WALK.strideRange[1] * PLAYER_WALK.bumpScale + 1e-9, `${half}`);
});

test('the same steps come out the same every time', () => {
  const run = () => {
    resetPlayerForm();
    const end = walk(8);
    return JSON.stringify(feetAt(end - STEP_MS / 2));
  };
  assert.equal(run(), run());
});

test('standing still he glances after a while, but not while a shot waits', () => {
  resetPlayerForm();
  const end = walk(2);
  const idle = end + PLAYER_WALK.alertMs + MAP_ANIMATION_MS.playerIdle;
  let turned = 0;
  for (let now = end; now < idle + 15000; now += 16) turned = Math.max(turned, Math.abs(playerPose(now).turn));
  assert.ok(turned > 0.3, 'he glanced');
  playerActive(idle + 15000);
  let steady = 0;
  for (let now = idle + 15000; now < idle + 30000; now += 16) steady = Math.max(steady, Math.abs(playerPose(now, false, true).turn));
  assert.equal(steady, 0, 'no glance or scan while a shot waits');
});

test('walking he hunches and settles; reduced motion stands him still, feet together', () => {
  resetPlayerForm();
  const end = walk(3);
  const walking = frames(end - STEP_MS, end);
  assert.ok(walking.rise < 0, 'hunched while walking');
  const still = playerPose(end + 10, true);
  assert.deepEqual(still.feet.map(f => [f.along, f.up]), [[0, 0], [0, 0]]);
  assert.equal(still.rise, 0);
  assert.equal(still.turn, 0);
});

test('the ember glows dimmest at the bottom of a breath, brightest at the top, steady when still', () => {
  assert.equal(emberGlow(-1), PLAYER_EMBER.low);
  assert.equal(emberGlow(1), PLAYER_EMBER.high);
  assert.ok(emberGlow(0) > PLAYER_EMBER.low && emberGlow(0) < PLAYER_EMBER.high);
  assert.equal(emberGlow(1, true), PLAYER_EMBER.mid);
  assert.equal(emberGlow(-1, true), PLAYER_EMBER.mid);
});
