// Unit tests for the advanced tutorial (js/advanced.js, floor.js
// buildAdvancedFloor; tutorial split plan): every station draws a start, a
// door in its top wall, a route and live spots on known furniture; the
// hide station's stick man comes out of the grate ("Not this one. Hide."),
// never gets a player who hid, and their hiding opens the door; the
// takedown station's stick man paces under the bookcase, "Now. Push."
// comes behind it, the push kills him and opens the door, and a push on
// nothing gives the book back; the lure station's tap works only with the
// light out (and can be tried again), bringing him under the bookcase; in
// the sneak station (One stick) crouching behind the table lets him pace
// past unseen and opens the door, standing in the open he hunts; the
// stations go in order, One stick's skipped with Turns; an open door is
// the way to the next station.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { ADVANCED_COVER_STEPS, ENERGY_MAX, FURNITURE_PIECES, SPOT_KINDS } from '../js/config.js';
import { ADVANCED_STATIONS, parseStation, advancedTurn, nextStation } from '../js/advanced.js';
import { buildAdvancedFloor } from '../js/floor.js';
import { advanceMonsters } from '../js/combat.js';
import { stepPlayer } from '../js/moves.js';
import { whatBlocks } from '../js/passage.js';
import { computeVisibility } from '../js/sight.js';
import { emptyFloor, gunRun } from './helpers.mjs';

// Station `name` on the turn rules (no one stick, no light battery), with
// energy in the book until the station empties it.
function station(name, settings = {}) {
  emptyFloor(10, { settings: { oneStick: false, lightBattery: false, noise: true, ...settings }, run: gunRun(3) });
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

test('every station has a start, a door in its top wall, a route and known furniture, its spots live', () => {
  ADVANCED_STATIONS.forEach((def, i) => {
    const room = parseStation(i);
    assert.ok(room.start, def.name + ' has a start');
    assert.equal(room.door.row, 0, def.name + '\'s door is in the top wall');
    assert.ok(room.route.length >= 2 && room.route.every(Boolean), def.name + ' has a route');
    assert.ok(room.props.length > 0, def.name + ' has furniture');
    room.props.forEach(p => assert.ok(FURNITURE_PIECES.includes(p.piece)));
    room.spots.forEach(s => assert.ok(SPOT_KINDS.includes(s.kind) && !s.used));
    assert.ok(def.hint, def.name + ' has a stuck hint');
  });
});

test('the stations go in order, the One stick ones skipped with Turns, and then the run', () => {
  const order = oneStick => {
    state.settings.oneStick = oneStick;
    const names = [];
    for (let i = nextStation(-1); i !== -1; i = nextStation(i)) names.push(ADVANCED_STATIONS[i].name);
    return names;
  };
  assert.deepEqual(order(true), ['hide', 'takedown', 'lure', 'sneak']);
  assert.deepEqual(order(false), ['hide', 'takedown', 'lure']);
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

test('lure: with the light on he sees it, not the sound, and the sink works again; light out, he comes under the bookcase', () => {
  const st = station('lure', { lightBattery: true });
  const f = state.floor;
  const m = st.minion;
  const sink = f.roomSpots.find(s => s.kind === 'lure');
  const shelf = f.roomSpots.find(s => s.kind === 'takedown');
  assert.equal(state.run.energy, 0);
  // Beside the sink, light on and pointed down the room at him.
  f.playerRow = sink.row - 1; f.playerCol = sink.col; f.facing = 'S';
  f.light = { on: true, charge: 4, locked: false, steady: true };
  m.row = 5; m.col = 3;
  computeVisibility();
  const seen = stepPlayer(1, 0);
  assert.ok(seen.some(e => e.type === 'lureSounded') && !seen.some(e => e.type === 'noiseHeard'));
  assert.deepEqual(lines(advancedTurn(seen)), ['adv.lure.light']);
  assert.ok(!sink.used, 'the sink works again');
  // Light out: he hears it, comes off his route and under the bookcase.
  f.light = { on: false, charge: 4, locked: false, steady: true };
  m.row = 6; m.col = 7;
  computeVisibility();
  const heard = stepPlayer(1, 0);
  assert.deepEqual(lines(advancedTurn(heard)), ['adv.lure.heard']);
  assert.equal(m.route, null);
  f.playerRow = shelf.row - 1; f.playerCol = shelf.tiles[1].col;
  computeVisibility();
  const under = () => m.row === shelf.row + 1 && shelf.tiles.some(t => t.col === m.col);
  for (let i = 0; i < 30 && !under(); i++) turns(1);
  assert.ok(under(), 'he came under the bookcase: ' + [m.row, m.col]);
  const push = stepPlayer(1, 0);
  assert.ok(push.some(e => e.type === 'minionKilled' && e.minion === m));
  assert.deepEqual(advancedTurn(push).slice(-1), [{ type: 'doorUnlocked', advanced: true }]);
});

// The sneak station with One stick and the light's rules on, the player
// crouched (sneaking) at `at`.
function sneakAt(at) {
  const st = station('sneak', { oneStick: true, lightBattery: true });
  const f = state.floor;
  f.playerRow = at.row; f.playerCol = at.col; f.facing = 'N'; f.look = 0; f.lookWant = 0;
  f.sneaking = true;
  computeVisibility();
  return st;
}

test('sneak: the player starts crouched behind the table, with the light on', () => {
  const st = station('sneak', { oneStick: true, lightBattery: true });
  const f = state.floor;
  const table = f.props.filter(p => p.piece === 'table');
  assert.ok(f.sneaking && f.light.on);
  assert.ok(table.some(p => p.row === f.playerRow - 1 && Math.abs(p.col - f.playerCol) <= 1), 'the table is just in front');
  assert.ok(ADVANCED_STATIONS[st.index].intro);
});

test('sneak: crouched behind the table, he paces past unseen and the door opens', () => {
  const st = sneakAt(parseStation(ADVANCED_STATIONS.findIndex(s => s.name === 'sneak')).start);
  const m = st.minion;
  assert.ok(state.floor.light.on);
  let said = [];
  for (let i = 0; i < 60 && !st.open; i++) said = said.concat(lines(turns(1)));
  assert.ok(st.open, 'the door opened');
  assert.deepEqual(said, ['adv.sneak.done']);
  assert.ok(m.route && !m.route.untilSeen, 'he only paces now');
  assert.ok(st.unseen >= ADVANCED_COVER_STEPS);
});

test('sneak: standing in the open with the light on, he sees the player and comes; the door stays shut', () => {
  const st = sneakAt({ row: 5, col: 7 });
  state.floor.sneaking = false;
  const m = st.minion;
  let said = [];
  for (let i = 0; i < 10 && m.route; i++) said = said.concat(lines(turns(1)));
  assert.equal(m.route, null, 'his route ended: he hunts');
  assert.ok(said.includes('adv.sneak.seen') || lines(turns(1)).includes('adv.sneak.seen'));
  assert.ok(!st.open);
});
