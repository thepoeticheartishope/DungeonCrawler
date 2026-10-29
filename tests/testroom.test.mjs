// Unit tests for the DEV test rooms (js/testroom.js, floor.js
// buildTestFloor, combat.js routeStep): every room draws a start, a route
// and known furniture with its spots live; the hide room's stick man walks
// to the player's side and then hunts, but never gets one who hid; the
// takedown room's walks its row back and forth for ever, and a bookcase
// pushed onto it as it passes kills it; the lure room's tap brings its
// stick man off his route to stand under the bookcase.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { FURNITURE_PIECES, SPOT_KINDS, TEST_ROOM_MINION_KIND } from '../js/config.js';
import { TEST_ROOMS, parseTestRoom } from '../js/testroom.js';
import { buildTestFloor } from '../js/floor.js';
import { advanceMonsters } from '../js/combat.js';
import { stepPlayer } from '../js/moves.js';
import { emptyFloor, gunRun } from './helpers.mjs';

// The test room `name` on the turn rules (no one stick, no light battery),
// with energy so a reach strikes instead of starting a Struggle.
function testFloor(name) {
  emptyFloor(10, { settings: { oneStick: false, lightBattery: false }, run: gunRun(3) });
  buildTestFloor(name);
  return state.floor.minions[0];
}

// Runs `n` turns of the stick men, returning every event.
function turns(n) {
  const events = [];
  for (let i = 0; i < n; i++) events.push(...advanceMonsters());
  return events;
}

test('every test room has a start, a route, known furniture and live spots on it', () => {
  Object.keys(TEST_ROOMS).forEach(name => {
    const room = parseTestRoom(name);
    assert.ok(room.start, name + ' has a start');
    assert.ok(room.route.length >= 2 && room.route.every(Boolean), name + ' has a route with no gaps');
    room.props.forEach(p => assert.ok(FURNITURE_PIECES.includes(p.piece), name + ': ' + p.piece));
    assert.ok(room.spots.length > 0, name + ' has a spot');
    room.spots.forEach(s => {
      assert.ok(SPOT_KINDS.includes(s.kind) && !s.used);
      s.tiles.forEach(t => assert.ok(room.props.some(p => p.row === t.row && p.col === t.col)));
    });
  });
});

test('a test room builds with its stick man on the start of its route', () => {
  const m = testFloor('takedown');
  const room = parseTestRoom('takedown');
  assert.equal(state.floor.testRoom, 'takedown');
  assert.equal(state.floor.minions.length, 1);
  assert.equal(m.minionKind, TEST_ROOM_MINION_KIND);
  assert.deepEqual([m.row, m.col], [room.route[0].row, room.route[0].col]);
  assert.deepEqual(state.floor.roomSpots.map(s => s.kind), ['takedown']);
  assert.equal(state.floor.roomSpots[0].tiles.length, 3);
});

test('the hide room\'s stick man walks to the player\'s side, then hunts and strikes', () => {
  const m = testFloor('hide');
  const end = parseTestRoom('hide').route[1];
  let reached = false;
  for (let i = 0; i < 40 && m.route; i++) {
    turns(1);
    if (m.row === end.row && m.col === end.col) reached = true;
  }
  assert.ok(reached, 'it stood on the route\'s last point');
  assert.equal(m.route, null);
  assert.ok(m.hunts);
  const events = turns(4);
  assert.ok(events.some(e => e.type === 'minionStruck'));
});

test('hidden in the stall, the hide room\'s stick man never gets the player', () => {
  const m = testFloor('hide');
  // One step east from the start, then a bump north-east into the stall.
  stepPlayer(0, 1);
  stepPlayer(-1, 1);
  assert.ok(state.floor.hidden, 'the player hid');
  const hearts = state.run.hearts;
  const events = turns(40);
  assert.ok(!events.some(e => e.type === 'minionStruck' || e.type === 'struggleStarted'));
  assert.equal(state.run.hearts, hearts);
  assert.equal(m.route, null);
});

test('the takedown room\'s stick man paces its row back and forth for ever', () => {
  const m = testFloor('takedown');
  const [a, b] = parseTestRoom('takedown').route;
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    turns(1);
    assert.equal(m.row, a.row, 'it stays on its row');
    seen.add(m.col);
  }
  assert.ok(seen.has(a.col) && seen.has(b.col), 'it reached both ends');
  assert.ok(m.route, 'the route never ends');
});

test('a bookcase pushed from behind as the stick man passes under it kills him', () => {
  const m = testFloor('takedown');
  const f = state.floor;
  const shelf = f.roomSpots[0];
  // Behind the bookcase, above its middle.
  f.playerRow = shelf.row - 1;
  f.playerCol = shelf.tiles[1].col;
  for (let i = 0; i < 60 && !shelf.tiles.some(t => t.col === m.col); i++) turns(1);
  assert.ok(shelf.tiles.some(t => t.col === m.col), 'he walked under it');
  const events = stepPlayer(1, 0);
  assert.ok(events.some(e => e.type === 'toppled'));
  assert.ok(events.some(e => e.type === 'minionKilled' && e.minion === m));
  assert.equal(f.minions.length, 0);
});

test('in the lure room the tap brings the pacing stick man under the bookcase, and a push kills him', () => {
  const m = testFloor('lure');
  state.settings.noise = true;
  const shelf = state.floor.roomSpots.find(s => s.kind === 'takedown');
  // From the start, down beside the sink, then a bump down into it.
  stepPlayer(1, 0);
  const lured = stepPlayer(1, 0);
  assert.ok(lured.some(e => e.type === 'lureSounded'));
  assert.ok(lured.some(e => e.type === 'noiseHeard' && e.minion === m));
  assert.equal(m.route, null, 'off his route');
  // Back up and along behind the bookcase.
  stepPlayer(-1, 0);
  stepPlayer(0, 1);
  stepPlayer(0, 1);
  const under = () => m.row === shelf.row + 1 && shelf.tiles.some(t => t.col === m.col);
  for (let i = 0; i < 30 && !under(); i++) turns(1);
  assert.ok(under(), 'he came to stand under the bookcase: ' + [m.row, m.col]);
  const push = stepPlayer(1, 0);
  assert.ok(push.some(e => e.type === 'minionKilled' && e.minion === m));
});
