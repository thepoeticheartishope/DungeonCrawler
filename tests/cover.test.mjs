// Unit tests for cover (Timothy 2026-10-26; sight.js crouching,
// besideCover, hiddenFrom): crouched with something solid between them,
// a stick man can't notice the player or their light; standing, or with
// no cover on the line, it does. Crouched beside cover, a mistake's sound
// carries COVER.noiseShare as far. A creep stays crouched once let go.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor } from './helpers.mjs';
import { state } from '../js/state.js';
import { NOISE_RANGES, COVER, ONE_STICK } from '../js/config.js';
import { computeVisibility, hiddenFrom, besideCover } from '../js/sight.js';
import { spawnMinion, advanceMonsters } from '../js/combat.js';
import { makeNoise } from '../js/noise.js';
import { BODY_ANGLES } from '../js/look.js';
import { walkFree, resetWalk, switchSneak } from '../js/walk.js';

// An open floor, player in the middle facing north (light on), One stick.
function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: { oneStick: true, lightBattery: true, simpleEnemies: false, noise: true, fogEnabled: true },
    floor: { look: BODY_ANGLES.N },
    see: false,
  });
  resetWalk();
  computeVisibility();
}

// A desk on the tile north of the player, a stick man 4 tiles north of it.
function deskBetween() {
  const f = state.floor;
  f.props.push({ kind: 'furniture', piece: 'desk', row: f.playerRow - 1, col: f.playerCol, searched: true });
  computeVisibility();
  return spawnMinion({ row: f.playerRow - 5, col: f.playerCol }, 'SHARD');
}

test('crouched behind cover, a stick man on its far side cannot notice the player or their light', () => {
  resetFloor();
  const m = deskBetween();
  state.floor.sneaking = true;
  assert.ok(hiddenFrom(m.row, m.col));
  advanceMonsters({ minions: true });
  assert.equal(m.lastSeen, null, 'it never locked on');
});

test('standing, or with nothing on the line, it notices them', () => {
  resetFloor();
  const m = deskBetween();
  assert.ok(!hiddenFrom(m.row, m.col), 'standing up');
  advanceMonsters({ minions: true });
  assert.ok(m.lastSeen, 'standing, it saw them');
  resetFloor();
  state.floor.props.push({ kind: 'furniture', piece: 'desk', row: state.floor.playerRow, col: state.floor.playerCol + 1, searched: true });
  const n = spawnMinion({ row: state.floor.playerRow - 5, col: state.floor.playerCol }, 'SHARD');
  state.floor.sneaking = true;
  assert.ok(!hiddenFrom(n.row, n.col), 'the desk is beside them, not between');
});

test("crouched beside cover, a mistake's sound carries COVER.noiseShare as far", () => {
  resetFloor();
  const loud = makeNoise('gate')[0].tiles;
  const far = Math.max(...loud.map(t => t.d));
  assert.equal(far, NOISE_RANGES.gate);
  deskBetween();
  state.floor.minions = [];
  state.floor.sneaking = true;
  assert.ok(besideCover());
  const quiet = makeNoise('gate')[0].tiles;
  assert.equal(Math.max(...quiet.map(t => t.d)), Math.round(NOISE_RANGES.gate * COVER.noiseShare));
});

test('a creep stays crouched once let go, until a full-pace walk or X', () => {
  resetFloor();
  walkFree(1, 0, { push: ONE_STICK.creep / 2, dtMs: 30 });
  walkFree(0, 0, { dtMs: 30 });
  assert.ok(state.floor.creeping, 'still crouched, standing still');
  walkFree(1, 0, { push: 1, dtMs: 30 });
  assert.ok(!state.floor.creeping, 'walking stands them up');
  walkFree(1, 0, { push: ONE_STICK.creep / 2, dtMs: 30 });
  switchSneak();
  switchSneak();
  assert.ok(!state.floor.creeping, 'X off stands them up');
});

test('crouching beside cover says so once', () => {
  resetFloor();
  deskBetween();
  state.floor.minions = [];
  state.floor.sneaking = true;
  assert.deepEqual(walkFree(0, 0, { dtMs: 16 }).map(e => e.type), ['coverTaken']);
  assert.deepEqual(walkFree(0, 0, { dtMs: 16 }), []);
});
