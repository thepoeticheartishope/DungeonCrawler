// Unit tests for the advanced tutorial (js/advanced.js, floor.js
// buildAdvancedFloor; tutorial split plan): every station draws a start, a
// door in its top wall, a route and live spots on known furniture; the
// hide station's stick man comes out of the grate ("Not this one. Hide."),
// never gets a player who hid, and their hiding opens the door; the
// takedown station's stick man paces under the bookcase, "Now. Push."
// comes behind it, the push kills him and opens the door, and a push on
// nothing gives the book back; an open door is the way to the next
// station.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { ENERGY_MAX, FURNITURE_PIECES, SPOT_KINDS } from '../js/config.js';
import { ADVANCED_STATIONS, parseStation, advancedTurn, lastStation } from '../js/advanced.js';
import { buildAdvancedFloor } from '../js/floor.js';
import { advanceMonsters } from '../js/combat.js';
import { stepPlayer } from '../js/moves.js';
import { whatBlocks } from '../js/passage.js';
import { emptyFloor, gunRun } from './helpers.mjs';

// Station `name` on the turn rules (no one stick, no light battery), with
// energy in the book until the station empties it.
function station(name) {
  emptyFloor(10, { settings: { oneStick: false, lightBattery: false }, run: gunRun(3) });
  buildAdvancedFloor(ADVANCED_STATIONS.findIndex(s => s.name === name));
  return state.floor.advanced;
}

// Turns of the stick men and the station together, as main.js runs them.
// Returns every event.
function turns(n) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const turn = advanceMonsters();
    events.push(...turn, ...advancedTurn(turn));
  }
  return events;
}

const lines = events => events.filter(e => e.type === 'whispered').map(e => e.line);

test('every station has a start, a door in its top wall, a route and live spots on known furniture', () => {
  ADVANCED_STATIONS.forEach((def, i) => {
    const room = parseStation(i);
    assert.ok(room.start, def.name + ' has a start');
    assert.equal(room.door.row, 0, def.name + '\'s door is in the top wall');
    assert.ok(room.route.length >= 2 && room.route.every(Boolean), def.name + ' has a route');
    assert.ok(room.spots.length > 0);
    room.props.forEach(p => assert.ok(FURNITURE_PIECES.includes(p.piece)));
    room.spots.forEach(s => assert.ok(SPOT_KINDS.includes(s.kind) && !s.used));
    assert.ok(def.hint, def.name + ' has a stuck hint');
  });
  assert.ok(lastStation(ADVANCED_STATIONS.length - 1));
  assert.ok(!lastStation(0));
});

test('hide: the book is empty, a stick man comes out of the grate, and the kind voice says to hide', () => {
  const st = station('hide');
  const f = state.floor;
  assert.equal(state.run.energy, 0);
  assert.equal(f.crawling[0], st.minion, 'it starts in the grate\'s duct');
  assert.deepEqual(whatBlocks(st.door.row, st.door.col), { kind: 'door' });
  assert.deepEqual(lines(turns(4)), ['tut.hide']);
});

test('hide: hiding opens the door, the stick man goes off to pace, and never gets the player', () => {
  const st = station('hide');
  const f = state.floor;
  const stall = f.roomSpots.find(s => s.kind === 'hide');
  turns(2);
  f.playerRow = stall.row + 1; f.playerCol = stall.col; f.facing = 'N';
  const hid = stepPlayer(-1, 0);
  assert.ok(hid.some(e => e.type === 'hid'));
  const opened = advancedTurn(hid);
  assert.deepEqual(lines(opened), ['adv.hide.done']);
  assert.deepEqual(opened.slice(-1), [{ type: 'doorUnlocked', advanced: true }]);
  assert.equal(whatBlocks(st.door.row, st.door.col), null);
  assert.ok(st.minion.route && !st.minion.hunts);
  const hearts = state.run.hearts;
  const events = turns(40);
  assert.ok(!events.some(e => e.type === 'minionStruck' || e.type === 'struggleStarted'));
  assert.equal(state.run.hearts, hearts);
  assert.ok(!events.some(e => e.type === 'doorUnlocked'), 'the door opens once');
});

test('an open station door is the way on', () => {
  const st = station('hide');
  const f = state.floor;
  st.done = true;
  advancedTurn([]);
  f.playerRow = st.door.row + 1; f.playerCol = st.door.col; f.facing = 'N';
  assert.deepEqual(stepPlayer(-1, 0).slice(-1), [{ type: 'stationLeft' }]);
});

test('takedown: behind the bookcase as he passes under: "Now. Push."; the push kills him and opens the door', () => {
  const st = station('takedown');
  const f = state.floor;
  const m = st.minion;
  const shelf = f.roomSpots.find(s => s.kind === 'takedown');
  assert.equal(state.run.energy, 0);
  f.playerRow = shelf.row - 1; f.playerCol = shelf.tiles[1].col; f.facing = 'S';
  let said = [];
  for (let i = 0; i < 40 && !(m.row === shelf.row + 1 && m.col === shelf.tiles[1].col); i++) said = said.concat(lines(turns(1)));
  assert.ok(said.includes('tut.push'), 'the kind voice said to push: ' + said);
  const push = stepPlayer(1, 0);
  assert.ok(push.some(e => e.type === 'minionKilled' && e.minion === m));
  assert.deepEqual(advancedTurn(push).slice(-1), [{ type: 'doorUnlocked', advanced: true }]);
  assert.equal(whatBlocks(st.door.row, st.door.col), null);
});

test('takedown: pushed onto nothing, "Too soon. The book, then." and the book is filled again; the door stays shut', () => {
  const st = station('takedown');
  const f = state.floor;
  const m = st.minion;
  const shelf = f.roomSpots.find(s => s.kind === 'takedown');
  m.row = shelf.row + 1; m.col = shelf.tiles[2].col + 2;
  f.playerRow = shelf.row - 1; f.playerCol = shelf.tiles[0].col; f.facing = 'S';
  const push = stepPlayer(1, 0);
  assert.ok(push.some(e => e.type === 'toppled') && !push.some(e => e.type === 'minionKilled'));
  assert.deepEqual(lines(advancedTurn(push)), ['tut.missed']);
  assert.equal(state.run.energy, ENERGY_MAX);
  assert.ok(!st.open);
  assert.deepEqual(whatBlocks(st.door.row, st.door.col), { kind: 'door' });
});
