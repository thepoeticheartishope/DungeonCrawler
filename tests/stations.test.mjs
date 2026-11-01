// Unit tests for the ship's stations (ship plan step B; stations.js, and the
// breakers in charger.js makeWires / powered / turnWire): breakers sit on
// the path set the right way, power stops at an open one and the wires are
// only done once every breaker is closed; a tap on an open breaker asks
// instead of turning; the ship has the Engineer's console, board and crew
// member; the board stays shut until the role is trained; training misses
// are free, teaching misses are crew failures; joined-up power trains the
// role at the console and is taught at the board.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { SHIP_STATIONS } from '../js/config.js';
import { makeWires, powered, rotated, solveWires, turnWire, openBreaker } from '../js/charger.js';
import { useStation, settleBreaker, stationDone, trainWires } from '../js/stations.js';
import { buildShipFloor } from '../js/floor.js';
import { emptyFloor } from './helpers.mjs';

// A fresh run on the ship, nothing trained yet.
function ship() {
  emptyFloor(10);
  state.run.trained = [];
  state.run.crewFailures = 0;
  buildShipFloor();
  return state.floor;
}

// The station prop of `kind` on the ship.
const prop = kind => state.floor.props.find(p => p.kind === kind);

// Turns `puzzle`'s path the right way (solveWires), leaving the breakers
// as they are: then only the breakers stand between PWR and the cell.
function wireUp(puzzle) {
  solveWires({ ...puzzle, breakers: [] }).forEach(i => { puzzle.wires[i] = rotated(puzzle.wires[i]); });
}

test('breakers sit on the path, set the right way; power stops at an open one', () => {
  for (let seed = 0; seed < 30; seed++) {
    const puzzle = makeWires(5, Math.random, 2);
    assert.equal(puzzle.breakers.length, 2);
    assert.equal(new Set(puzzle.breakers).size, 2);
    wireUp(puzzle);
    assert.equal(powered(puzzle).done, false, 'open breakers block');
    assert.equal(powered({ ...puzzle, breakers: [] }).done, true, 'the rest is wired up');
    puzzle.closed.push(...puzzle.breakers);
    assert.equal(powered(puzzle).done, true, 'closed, power gets through');
  }
});

test('a tap on an open breaker asks instead of turning; a closed one does nothing', () => {
  const station = { puzzle: makeWires(5, Math.random, 1) };
  const [b] = station.puzzle.breakers;
  const before = station.puzzle.wires[b];
  assert.deepEqual(turnWire(station, b), [{ type: 'breakerAsked', index: b }]);
  assert.equal(station.puzzle.wires[b], before);
  station.puzzle.closed.push(b);
  assert.equal(openBreaker(station.puzzle, b), false);
  assert.deepEqual(turnWire(station, b), []);
});

test('the charger\'s wires have no breakers', () => {
  const puzzle = makeWires(4);
  assert.deepEqual(puzzle.breakers, []);
});

test('the ship has the Engineer\'s console, power board and crew member', () => {
  ship();
  for (const kind of ['console', 'powerBoard', 'crew']) {
    assert.ok(prop(kind), kind);
    assert.equal(prop(kind).role, 'engineer');
  }
  const command = state.floor.chamberAt.get(key(prop('console').row, prop('console').col));
  assert.equal(state.floor.chamberNames[command], 'plan.ship.command');
});

test('the power board stays shut until the role is trained; the Engineer says so', () => {
  ship();
  assert.deepEqual(useStation(prop('powerBoard')), [{ type: 'stationLocked', role: 'engineer' }]);
  assert.deepEqual(useStation(prop('crew')), [{ type: 'crewSpoke', role: 'engineer', trained: false }]);
  state.run.trained.push('engineer');
  const [opened] = useStation(prop('powerBoard'));
  assert.equal(opened.type, 'stationOpened');
  assert.equal(opened.mode, 'teach');
  assert.equal(prop('powerBoard').puzzle.n, SHIP_STATIONS.teach.size);
  assert.equal(prop('powerBoard').puzzle.breakers.length, SHIP_STATIONS.teach.breakers);
});

test('the console opens training wires and keeps them as left', () => {
  ship();
  const [first] = trainWires(prop('console'));
  assert.equal(first.mode, 'train');
  assert.equal(first.kept, false);
  assert.equal(prop('console').puzzle.n, SHIP_STATIONS.train.size);
  const [again] = trainWires(prop('console'));
  assert.equal(again.kept, true);
});

test('a miss at the console is free; a miss at the board is a crew failure', () => {
  ship();
  trainWires(prop('console'));
  const [b] = prop('console').puzzle.breakers;
  assert.deepEqual(settleBreaker(prop('console'), b, false), [{ type: 'breakerSparked', index: b, teach: false }]);
  assert.equal(state.run.crewFailures, 0);
  state.run.trained.push('engineer');
  useStation(prop('powerBoard'));
  const [c] = prop('powerBoard').puzzle.breakers;
  assert.deepEqual(settleBreaker(prop('powerBoard'), c, false), [{ type: 'breakerSparked', index: c, teach: true }]);
  assert.equal(state.run.crewFailures, 1);
  assert.ok(openBreaker(prop('powerBoard').puzzle, c), 'still open');
});

test('the last breaker closing on wired-up power trains the role at the console', () => {
  ship();
  const console = prop('console');
  trainWires(console);
  wireUp(console.puzzle);
  const [b] = console.puzzle.breakers;
  const events = settleBreaker(console, b, true);
  assert.deepEqual(events.map(e => e.type), ['breakerClosed', 'stationTrained']);
  assert.deepEqual(state.run.trained, ['engineer']);
  assert.equal(console.puzzle, null);
});

test('joined-up power at the board teaches the Engineer and clears the wires', () => {
  ship();
  state.run.trained.push('engineer');
  const board = prop('powerBoard');
  useStation(board);
  assert.equal(stationDone(board)[0].type, 'stationTaught');
  assert.equal(board.puzzle, null);
});
