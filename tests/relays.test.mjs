// Unit tests for relays.js (strategy plan step B): settling a relay's
// question, the held room staying dark, and minions kept out of it.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { RELAY_TURNS_BACK, RELAY_TURNS_CAP, RELAY_WRONG_TURNS, LIGHT_TURNS_PER_STEP } from '../js/config.js';
import { settleRelay, keptOut } from '../js/relays.js';
import { initBossLight, advanceLight } from '../js/light.js';
import { advanceMonsters, spawnMinion } from '../js/combat.js';
import { resetHaunts } from '../js/haunts.js';

// These are the turn game's rules (the start screen's Turns option): One
// stick, the default since one stick plan step G, has its own tests.
state.settings.oneStick = false;

// An open 15x15 floor. Room 1 is rows 1-5, cols 9-13 (a relay at its
// middle); everything else is room 0. The boss sits in the far corner.
function resetFloor() {
  const f = state.floor;
  f.GRID_SIZE = 15;
  f.playerRow = 12;
  f.playerCol = 2;
  f.facing = 'N';
  f.wallSet = new Set();
  f.pillarSet = new Set();
  f.minions = [];
  f.hunter = null;
  f.props = [];
  f.chest = null;
  f.coin = null;
  f.stairs = null;
  f.darkness = false;
  f.darkTurns = 0;
  f.boss = { row: 1, col: 1, hp: 3 };
  f.chamberAt = new Map();
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    f.chamberAt.set(key(r, c), r >= 1 && r <= 5 && c >= 9 && c <= 13 ? 1 : 0);
  }
  f.heldChambers = new Set();
  f.relayTurnsWon = 0;
  f.misses = 0;
  state.settings.gunCombat = false;
  state.settings.fogEnabled = false;
  state.run.correctTotal = 0;
  state.run.turnCount = 0;
  state.run.hearts = 3;
  state.run.energy = 0;
  state.run.bonusSlack = 0;
  state.run.roomIndex = 0;
  state.battle.currentQuestion = { term: 'Who built the ark?', meaning: 'Noah' };
  state.battle.selectedTarget = null;
  state.battle.struggle = null;
  resetHaunts();
  initBossLight();
}

const relay = () => ({ row: 3, col: 11, kind: 'relay', searched: false });

test('a right answer holds the room and takes turns off the light', () => {
  resetFloor();
  // Spread the light far enough to reach room 1.
  for (let i = 0; i < 20 * LIGHT_TURNS_PER_STEP; i++) advanceLight();
  assert.ok(state.floor.bossLitSet.has(key(3, 11)), 'room 1 is lit before');
  const before = state.floor.lightTurns;
  const r = relay();
  const events = settleRelay(true, r);
  assert.equal(events[0].type, 'relayHeld');
  assert.equal(events[0].turns, RELAY_TURNS_BACK);
  assert.equal(state.floor.lightTurns, before - RELAY_TURNS_BACK);
  assert.ok(r.searched, 'the relay is used up');
  assert.ok(state.floor.heldChambers.has(1));
  assert.ok(!state.floor.bossLitSet.has(key(3, 11)), 'the held room stays dark');
  advanceLight();
  assert.ok(!state.floor.bossLitSet.has(key(3, 11)), 'and stays dark as the light spreads');
});

test('turns won back stop at RELAY_TURNS_CAP a floor', () => {
  resetFloor();
  state.floor.lightTurns = 100;
  settleRelay(true, relay());
  const second = settleRelay(true, relay());
  assert.equal(state.floor.relayTurnsWon, Math.min(RELAY_TURNS_CAP, 2 * RELAY_TURNS_BACK));
  assert.equal(second[0].turns, RELAY_TURNS_CAP - RELAY_TURNS_BACK);
});

test('a wrong answer feeds the light and counts as a miss', () => {
  resetFloor();
  const events = settleRelay(false, relay());
  assert.equal(events[0].type, 'relaySparked');
  assert.equal(state.floor.lightTurns, RELAY_WRONG_TURNS);
  assert.equal(state.floor.misses, 1);
  assert.equal(state.floor.heldChambers.size, 0);
});

test('with the boss down, a relay only holds the room', () => {
  resetFloor();
  state.floor.boss = null;
  const events = settleRelay(true, relay());
  assert.equal(events[0].turns, 0);
  assert.equal(state.floor.lightTurns, 0);
});

test('minions outside a held room cannot enter; one inside may stay', () => {
  resetFloor();
  state.floor.heldChambers.add(1);
  const outside = spawnMinion({ row: 3, col: 7 }, null);
  const inside = spawnMinion({ row: 3, col: 10 }, null);
  assert.ok(keptOut(outside).has(key(3, 10)));
  assert.equal(keptOut(inside).size, 0);
});

test('a player inside a held room is not chased, even from the doorway', () => {
  resetFloor();
  state.floor.darkness = true; // every minion hunts, from anywhere
  state.floor.heldChambers.add(1);
  state.floor.playerRow = 3;
  state.floor.playerCol = 9;
  const m = spawnMinion({ row: 3, col: 8 }, null);
  state.floor.minions = [m];
  for (let i = 0; i < 10; i++) {
    const events = advanceMonsters();
    assert.ok(!events.some(e => e.type === 'minionEngaged'), 'never engages');
    assert.notEqual(state.floor.chamberAt.get(key(m.row, m.col)), 1, 'never steps in');
  }
});
