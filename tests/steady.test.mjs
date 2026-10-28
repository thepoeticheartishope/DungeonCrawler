// Unit tests for steady aim (STEADY_AIM, steady aim plan step A): SELECT held steadies
// a shot instead of opening the dial; the chance to land climbs to 1 at
// full hold and falls while the arm shakes; letting go spends the round
// and settles a kill (full hold), a maim (below it) or a miss; the arm
// drops back after holding too long; a stick man leaving the aim lowers
// the gun for nothing.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor, gunRun } from './helpers.mjs';
import { state } from '../js/state.js';
import { STEADY_AIM } from '../js/config.js';
import { computeVisibility, inLookCone, shootBlock } from '../js/sight.js';
import { spawnMinion } from '../js/combat.js';
import { BODY_ANGLES } from '../js/look.js';
import {
  fire, refreshGunTarget, startSteady, steadying, tickSteady, steadyChance, steadyShaking, releaseSteady, cancelSteady, holdSteady,
} from '../js/gun.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

// An open floor, player in the middle facing north, One stick on, two rounds.
function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: {
      oneStick: true, freeLook: true, eightWays: true, fogEnabled: true, gunCombat: true, downed: true,
      noise: true, simpleEnemies: false, lightBattery: true, steadyAim: true,
    },
    run: gunRun(2),
    floor: { look: BODY_ANGLES.N },
  });
}

// A stick man two tiles ahead, aimed at and steadying.
function steadyOn(kind = 'SHARD') {
  resetFloor();
  const m = spawnMinion({ row: state.floor.playerRow - 2, col: state.floor.playerCol }, kind);
  computeVisibility();
  refreshGunTarget();
  fire(state.floor.gunTarget);
  startSteady();
  return m;
}

test('steadying climbs to full in fullMs and the chance climbs with it to 1', () => {
  steadyOn();
  assert.ok(steadying());
  const aim = state.battle.aim;
  assert.ok(near(steadyChance(aim), STEADY_AIM.minChance));
  tickSteady(STEADY_AIM.fullMs / 2);
  assert.ok(near(aim.steady, 0.5));
  assert.ok(near(steadyChance(aim), 0.5));
  tickSteady(STEADY_AIM.fullMs / 2);
  assert.equal(aim.steady, 1);
  assert.equal(steadyChance(aim), 1);
  assert.equal(state.run.energy, 2, 'nothing is spent while holding');
});

test('held on the head too long the arm shakes, the chance falls, then the aim drops', () => {
  steadyOn();
  const aim = state.battle.aim;
  tickSteady(STEADY_AIM.fullMs);
  tickSteady(STEADY_AIM.shakeAfterMs + 1);
  assert.ok(steadyShaking(aim));
  assert.ok(steadyChance(aim) < 1);
  const events = tickSteady(STEADY_AIM.dropAtMs);
  assert.deepEqual(events.map(e => e.type), ['steadyDropped']);
  assert.ok(near(aim.steady, STEADY_AIM.dropTo));
});

test('letting go at full hold kills; it spends the round', () => {
  const m = steadyOn();
  tickSteady(STEADY_AIM.fullMs);
  const types = releaseSteady().map(e => e.type);
  assert.ok(types.includes('minionKilled'), types.join());
  assert.ok(!state.floor.minions.includes(m));
  assert.equal(state.run.energy, 1);
  assert.equal(state.battle.aim, null);
});

test('a hit below full hold maims (the stick man goes down)', () => {
  const m = steadyOn();
  tickSteady(STEADY_AIM.fullMs * 0.99);
  const random = Math.random;
  Math.random = () => 0;
  try {
    const types = releaseSteady().map(e => e.type);
    assert.ok(types.includes('minionDowned'), types.join());
    assert.ok(m.downed);
  } finally {
    Math.random = random;
  }
});

test('a miss late in the hold is a plain miss; early in the hold it is a harm', () => {
  const random = Math.random;
  Math.random = () => 0.999;
  try {
    steadyOn();
    tickSteady(STEADY_AIM.fullMs * 0.6);
    assert.ok(releaseSteady().some(e => e.type === 'shotMissed'));
    steadyOn();
    tickSteady(STEADY_AIM.fullMs * 0.1);
    const types = releaseSteady().map(e => e.type);
    assert.ok(types.some(t => ['shotJammed', 'shotLoud', 'shotLunged'].includes(t)), types.join());
  } finally {
    Math.random = random;
  }
});

test('lowering the gun spends nothing; a stick man gone from the aim lowers it', () => {
  steadyOn();
  assert.deepEqual(cancelSteady().map(e => e.type), ['shotCancelled']);
  assert.equal(state.run.energy, 2);
  const m = steadyOn();
  state.floor.minions = state.floor.minions.filter(n => n !== m);
  assert.deepEqual(tickSteady(16).map(e => e.type), ['steadyLost']);
  assert.equal(state.battle.aim, null);
  assert.equal(state.run.energy, 2);
});

test('a weaving STALKER steadies slower (STEADY_AIM.kindSlow)', () => {
  steadyOn('STALKER');
  tickSteady(STEADY_AIM.fullMs / 2);
  assert.ok(near(state.battle.aim.steady, 0.5 * STEADY_AIM.kindSlow.STALKER));
});

test('steady aim is the default since step C', () => {
  assert.equal(STEADY_AIM.on, true);
});

test('DEV -> Auto-win holds the aim at full, so letting go kills', () => {
  const m = steadyOn();
  holdSteady();
  const types = releaseSteady().map(e => e.type);
  assert.ok(types.includes('minionKilled'), types.join());
  assert.ok(!state.floor.minions.includes(m));
});

test('the light narrows to a beam as the aim steadies, and opens again after', () => {
  steadyOn();
  const f = state.floor;
  // Two ahead and two to the side: 45 degrees off, inside the full cone.
  const side = { row: f.playerRow - 2, col: f.playerCol + 2 };
  assert.ok(inLookCone(side.row, side.col), 'in the cone at first');
  tickSteady(STEADY_AIM.fullMs);
  assert.ok(!inLookCone(side.row, side.col), 'outside the beam at full hold');
  cancelSteady();
  assert.ok(inLookCone(side.row, side.col), 'the cone opens again');
});

test('the beam stays on a stick man stepping aside while the aim steadies', () => {
  const m = steadyOn();
  tickSteady(STEADY_AIM.fullMs);
  m.col += 1;
  const events = tickSteady(16);
  assert.ok(steadying(), 'still steadying: ' + events.map(e => e.type).join(','));
  assert.equal(shootBlock(m), null);
});
