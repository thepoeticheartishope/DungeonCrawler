// Unit tests for the gun with One stick (one stick plan step E): the
// target is the seen stick man closest to where the light points, and
// follows it as it swings; a tap on one swings the light to it (no
// "turn first" line); a landed shot stops a reach; a lunge reaches first.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshLight } from '../js/battery.js';
import { state } from '../js/state.js';
import { MAX_HEARTS, ONE_STICK } from '../js/config.js';
import { computeVisibility } from '../js/sight.js';
import { spawnMinion, clockFrame, lungeAt } from '../js/combat.js';
import { resetHaunts } from '../js/haunts.js';
import { BODY_ANGLES, swingLook } from '../js/look.js';
import { fire, readyShot, settleShot, pickTarget, refreshGunTarget } from '../js/gun.js';

// An open floor, player in the middle facing north, the gun on, One stick
// on, two rounds of energy.
function resetFloor(size = 21) {
  const f = state.floor;
  f.GRID_SIZE = size;
  f.playerRow = Math.floor(size / 2);
  f.playerCol = Math.floor(size / 2);
  f.playerAt = null;
  f.facing = 'N';
  f.look = BODY_ANGLES.N;
  f.lookWant = null;
  f.darkness = false;
  f.darkTurns = 0;
  f.light = freshLight();
  f.wallSet = new Set();
  f.pillarSet = new Set();
  f.bossLitSet = new Set();
  f.exploredSet = new Set();
  f.heldChambers = new Set();
  f.chamberAt = new Map();
  f.visitedChambers = new Set();
  f.boss = null;
  f.hunter = null;
  f.minions = [];
  f.crawling = [];
  f.vents = [];
  f.keys = [];
  f.chest = null;
  f.exchange = null;
  f.tutorial = null;
  f.props = [];
  f.gunTarget = null;
  f.struggles = 0;
  state.settings.oneStick = true;
  state.settings.freeLook = true;
  state.settings.eightWays = true;
  state.settings.fogEnabled = true;
  state.settings.gunCombat = true;
  state.settings.downed = true;
  state.settings.noise = true;
  state.settings.simpleEnemies = false;
  state.settings.lightBattery = true;
  state.run.roomIndex = 0;
  state.run.turnCount = 0;
  state.run.hearts = MAX_HEARTS;
  state.run.energy = 2;
  state.run.rounds = [null, null];
  state.run.weakTo = {};
  state.run.weakKnown = new Set();
  state.battle.selectedTarget = null;
  state.battle.aim = null;
  state.battle.struggle = null;
  resetHaunts();
  computeVisibility();
}

function minionAt(dr, dc, kind = 'SHARD') {
  const m = spawnMinion({ row: state.floor.playerRow + dr, col: state.floor.playerCol + dc }, kind);
  m.hunts = true;
  computeVisibility();
  return m;
}

// Fires at `m`, presses READY and stops the dial in the middle of its
// first `tier` zone.
function shoot(m, tier) {
  const real = Math.random;
  Math.random = () => 0;
  try { fire(m); } finally { Math.random = real; }
  readyShot();
  const zone = state.battle.aim.zones.find(z => z.tier === tier);
  return settleShot((zone.from + zone.to) / 2);
}

test('the target is the one closest to where the light points, and follows its swing', () => {
  resetFloor();
  const north = minionAt(-3, 0);
  const east = minionAt(0, 3);
  refreshGunTarget();
  assert.equal(state.floor.gunTarget, north);
  state.floor.lookWant = BODY_ANGLES.E;
  for (let i = 0; i < 30; i++) swingLook(16);
  assert.equal(state.floor.gunTarget, east);
});

test('a tap on a seen stick man outside the cone swings the light to it, with no line', () => {
  resetFloor();
  // Beside the player it is seen, but outside the cone until they look.
  const east = minionAt(0, 1);
  assert.deepEqual(pickTarget({ row: east.row, col: east.col }), []);
  assert.ok(Math.abs(state.floor.lookWant - BODY_ANGLES.E) < 1e-9);
  for (let i = 0; i < 30; i++) swingLook(16);
  assert.equal(state.floor.gunTarget, east);
});

test('a landed shot stops a reach', () => {
  resetFloor();
  const m = minionAt(-1, 0, 'HUSK');
  clockFrame(ONE_STICK.wanderMs * 2);
  assert.ok(m.reaching, 'it reaches');
  const events = shoot(m, 'kill');
  assert.ok(events.some(e => e.type === 'reachBroken'));
  assert.equal(m.reaching, null);
  const later = [];
  for (let t = 0; t < ONE_STICK.reachGuardMs; t += 10) later.push(...clockFrame(10));
  assert.ok(!later.some(e => e.type === 'minionStruck'), 'no strike follows');
  assert.equal(state.run.hearts, MAX_HEARTS);
});

test('a lunge onto the player reaches first', () => {
  resetFloor();
  const m = minionAt(-2, 0);
  const events = lungeAt(m);
  assert.deepEqual(events.map(e => e.type), ['minionMoved']);
  assert.deepEqual(lungeAt(m).map(e => e.type), ['reachStarted']);
  assert.equal(state.run.hearts, MAX_HEARTS);
});
