// Unit tests for the ducts (vents and noise plan step C, vents.js
// ductStep / crawlInto / crawlTurn): hunting stick men that fit crawl
// from a grate to its pair, the far grate shudders a turn before one
// drops out, and the player learns the pair by seeing it.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor, twoRooms } from './helpers.mjs';
import { state, key } from '../js/state.js';
import { VENT_TURNS } from '../js/config.js';
import { advanceMonsters, spawnMinion } from '../js/combat.js';
import { toggleLight } from '../js/battery.js';
import { computeVisibility } from '../js/sight.js';
import { whatBlocks } from '../js/passage.js';

// A 21x21 floor: room 0 on the left (cols 1-6), room 1 on the right
// (cols 14-19), joined by a hallway along row 10 (no room). Walls
// everywhere else. A grate in each room's top corner, a pair. The player
// stands at the bottom of room 0, light off, so no stick man sees them.
function resetFloor() {
  emptyFloor(21, {
    settings: { freeLook: true, fogEnabled: true, gunCombat: false, eightWays: true, lightBattery: true, simpleEnemies: false, gaze: true, noise: true },
    see: false,
  });
  twoRooms();
  state.floor.vents = [{ row: 1, col: 1, pair: 1, known: false }, { row: 1, col: 19, pair: 0, known: false }];
  state.floor.look = 0;
  toggleLight();
  computeVisibility();
}

// Plays turns until `done(events)` or `max` turns; returns every turn's
// events, in order.
function playUntil(done, max = 30) {
  const turns = [];
  for (let i = 0; i < max; i++) {
    const events = advanceMonsters();
    turns.push(events);
    if (done(events)) break;
  }
  return turns;
}
const types = events => events.map(e => e.type);

// A stick man in room 1 by its grate, after the player, who was last
// known at the top of room 0 by the other grate: the duct is far quicker.
function hunter(kind) {
  resetFloor();
  const m = spawnMinion({ row: 2, col: 18 }, kind);
  m.lastSeen = { row: 3, col: 2 };
  m.track = 5;
  return m;
}

test('a hunting STALKER takes the duct: in, a shudder, then out by the far grate', () => {
  const m = hunter('STALKER');
  const turns = playUntil(events => types(events).includes('ventDropped'));
  const flat = turns.map(types);
  const inAt = flat.findIndex(t => t.includes('ventEntered'));
  const rattleAt = flat.findIndex(t => t.includes('ventRattled'));
  const dropAt = flat.findIndex(t => t.includes('ventDropped'));
  assert.ok(inAt !== -1, 'it went in');
  assert.equal(rattleAt, inAt + VENT_TURNS - 1, 'the far grate shudders the turn after');
  assert.equal(dropAt, rattleAt + 1, 'one turn of warning, then it drops');
  const rattle = turns[rattleAt].find(e => e.type === 'ventRattled');
  assert.deepEqual([rattle.vent.row, rattle.vent.col], [1, 1], 'the far grate');
  assert.ok(Math.max(Math.abs(m.row - 1), Math.abs(m.col - 1)) === 1, 'beside the far grate');
  assert.ok(state.floor.minions.includes(m));
  assert.equal(state.floor.crawling.length, 0);
});

test('in a duct it is out of play: off the floor, no strike, no warning, nothing blocks its grate', () => {
  const m = hunter('SHARD');
  playUntil(events => types(events).includes('ventEntered'));
  assert.ok(m.vent);
  assert.ok(!state.floor.minions.includes(m));
  assert.ok(state.floor.crawling.includes(m));
  assert.equal(whatBlocks(m.row, m.col), null, 'the player can step on its grate');
  // The player stands right where it will come out: no "I see you.", no strike.
  state.floor.playerRow = 2;
  state.floor.playerCol = 2;
  const next = advanceMonsters();
  assert.ok(!types(next).includes('presenceSensed'));
  assert.ok(!types(next).includes('minionEngaged'));
});

test('a HUSK is too big for the ducts', () => {
  hunter('HUSK');
  const turns = playUntil(() => false, 8);
  assert.ok(!turns.flat().some(e => e.type === 'ventEntered'));
});

test('the hunter uses the ducts too', () => {
  resetFloor();
  state.floor.darkness = true;
  state.floor.darkTurns = 0;
  const m = spawnMinion({ row: 2, col: 18 }, null);
  m.kind = 'hunter';
  m.rest = 0;
  state.floor.hunter = m;
  state.floor.playerRow = 3;
  state.floor.playerCol = 2;
  const turns = playUntil(events => types(events).includes('ventEntered'), 4);
  assert.ok(turns.flat().some(e => e.type === 'ventEntered' && e.minion === m));
  assert.equal(whatBlocks(m.row, m.col), null, 'its grate is free while it crawls');
});

test('an idle stick man walks over a grate and never goes in', () => {
  resetFloor();
  spawnMinion({ row: 1, col: 18 }, 'SHARD');
  const turns = playUntil(() => false, 30);
  assert.ok(!turns.flat().some(e => e.type === 'ventEntered'));
});

test('a sealed grate is never used', () => {
  hunter('STALKER');
  state.floor.heldChambers.add(0);
  const turns = playUntil(() => false, 6);
  assert.ok(!turns.flat().some(e => e.type === 'ventEntered'));
});

test('DEV -> Noise off: the grates are just floor', () => {
  hunter('STALKER');
  state.settings.noise = false;
  const turns = playUntil(() => false, 6);
  assert.ok(!turns.flat().some(e => e.type === 'ventEntered'));
});

test('seen coming out, the pair is known; unseen, it stays unknown', () => {
  hunter('STALKER');
  playUntil(events => types(events).includes('ventDropped'));
  assert.ok(!state.floor.vents[0].known, 'the player was far away in the dark');

  const m = hunter('STALKER');
  // The player stands below the far grate with the light on, looking at it.
  state.floor.playerRow = 4;
  state.floor.playerCol = 1;
  toggleLight();
  computeVisibility();
  assert.ok(state.floor.visibleSet.has(key(1, 1)));
  const turns = playUntil(events => types(events).includes('ventDropped'));
  const drop = turns.flat().find(e => e.type === 'ventDropped');
  assert.equal(drop.minion, m);
  assert.ok(drop.seen);
  assert.ok(state.floor.vents[0].known && state.floor.vents[1].known);
});

test('a duct sealed while it crawls: it comes back out the way it went in', () => {
  const m = hunter('STALKER');
  playUntil(events => types(events).includes('ventEntered'));
  state.floor.heldChambers.add(0);
  playUntil(events => types(events).includes('ventDropped'));
  assert.ok(m.col >= 14, 'back in room 1');
});
