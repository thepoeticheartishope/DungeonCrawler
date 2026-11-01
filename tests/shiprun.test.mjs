// Unit tests for the ship's run (ship plan step C; ship.js, and how
// stations.js feeds it): a fresh run is calm with a tragedy every part of
// which has wording; a failure raises the panic and Broken ends the run;
// three right answers in a row calm it; the panic makes the crew's work
// harder (slipping wires); no timers: time passing changes nothing; the
// last crew member taught brings the ship in.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { SHIP_RUN, TRAGEDY_PARTS } from '../js/config.js';
import { TEXT } from '../js/text.js';
import {
  freshShipRun, rollTragedy, crewMissed, crewRight, slipEveryMs, shipFrame,
} from '../js/ship.js';
import { useStation, settleBreaker, stationDone, trainWires } from '../js/stations.js';
import { buildShipFloor } from '../js/floor.js';
import { powered, solveWires, rotated } from '../js/charger.js';
import { emptyFloor } from './helpers.mjs';

// A fresh ship run on the ship.
function shipRun() {
  emptyFloor(10);
  freshShipRun();
  buildShipFloor();
  return state.run.ship;
}

const prop = kind => state.floor.props.find(p => p.kind === kind);

test('a fresh run is calm, nothing trained, and its tragedy all has wording', () => {
  const ship = shipRun();
  assert.equal(ship.panic, 0);
  assert.deepEqual(state.run.trained, []);
  for (let i = 0; i < 50; i++) {
    const tragedy = rollTragedy();
    for (const part of Object.keys(TRAGEDY_PARTS)) {
      assert.ok('tragedy.' + part + '.' + tragedy[part] in TEXT, part + ' ' + tragedy[part]);
    }
  }
  for (const part of Object.keys(TRAGEDY_PARTS)) {
    for (let n = 1; n <= TRAGEDY_PARTS[part]; n++) assert.ok('tragedy.' + part + '.' + n in TEXT, part + ' ' + n);
  }
});

test('each failure raises the panic a step; at Broken the run is lost', () => {
  shipRun();
  for (let level = 1; level < SHIP_RUN.brokenAt; level++) {
    assert.deepEqual(crewMissed(), [{ type: 'panicRose', level }]);
  }
  assert.deepEqual(crewMissed(), [{ type: 'panicRose', level: SHIP_RUN.brokenAt }, { type: 'shipEnded', how: 'panic' }]);
});

test('right answers in a row calm the panic a step; a miss breaks the run of them', () => {
  const ship = shipRun();
  crewMissed();
  crewMissed();
  assert.deepEqual(crewRight(), []);
  crewMissed();
  assert.equal(ship.streak, 0);
  for (let i = 1; i < SHIP_RUN.calmStreak; i++) assert.deepEqual(crewRight(), []);
  assert.deepEqual(crewRight(), [{ type: 'panicEased', level: 2 }]);
  assert.equal(ship.streak, 0);
});

test('the panic makes the work harder: wires slip once Shaken', () => {
  const ship = shipRun();
  assert.equal(slipEveryMs(), 0);
  ship.panic = 1;
  assert.equal(slipEveryMs(), 0);
  ship.panic = 2;
  assert.equal(slipEveryMs(), SHIP_RUN.slipEveryMs[2]);
});

test('no timers: time passing never ends the run, learns a role or clears a board', () => {
  const ship = shipRun();
  trainWires(prop('console'));
  state.run.trained.push('engineer');
  useStation(prop('powerBoard'));
  assert.deepEqual(shipFrame(10 * 60 * 1000), []);
  assert.equal(state.run.runEnded, false);
  assert.deepEqual(state.run.trained, ['engineer']);
  assert.ok(prop('powerBoard').puzzle, 'the board keeps its wires');
  assert.equal(ship.panic, 0);
});

test('a teaching miss raises the panic; a training miss does not', () => {
  const ship = shipRun();
  trainWires(prop('console'));
  const [b] = prop('console').puzzle.breakers;
  settleBreaker(prop('console'), b, false);
  assert.equal(ship.panic, 0);
  state.run.trained.push('engineer');
  useStation(prop('powerBoard'));
  const [c] = prop('powerBoard').puzzle.breakers;
  const events = settleBreaker(prop('powerBoard'), c, false);
  assert.deepEqual(events.map(e => e.type), ['breakerSparked', 'panicRose']);
  assert.equal(ship.panic, 1);
});

test('a Shaken crew slips a powered wire every so often while the Engineer is being taught', () => {
  const ship = shipRun();
  state.run.trained.push('engineer');
  useStation(prop('powerBoard'));
  ship.panic = 2;
  const board = prop('powerBoard');
  // The path turned the right way up to the first breaker, so there are
  // powered wires to slip.
  solveWires({ ...board.puzzle, breakers: [] }).forEach(i => { board.puzzle.wires[i] = rotated(board.puzzle.wires[i]); });
  const before = board.puzzle.wires.slice();
  assert.ok(powered(board.puzzle).on.size > 1);
  const events = shipFrame(SHIP_RUN.slipEveryMs[2]);
  const slip = events.find(e => e.type === 'wireSlipped');
  assert.ok(slip, 'a wire slipped');
  assert.notEqual(board.puzzle.wires[slip.index], before[slip.index]);
  assert.ok(!board.puzzle.breakers.includes(slip.index), 'never a breaker');
});

test('the board teaches the Engineer once; if that was the last crew member, the ship arrives', () => {
  const ship = shipRun();
  ship.onDuty = ['navigator'];
  state.run.trained.push('engineer');
  const board = prop('powerBoard');
  useStation(board);
  assert.deepEqual(stationDone(board).map(e => e.type), ['stationTaught'], 'the Navigator is still to teach');
  assert.ok(ship.taught.includes('engineer'));
  assert.deepEqual(useStation(board), [{ type: 'crewSpoke', role: 'engineer', taught: true }], 'taught once');
  ship.taught = [];
  ship.onDuty = [];
  useStation(board);
  assert.deepEqual(stationDone(board).map(e => e.type), ['stationTaught', 'shipEnded'], 'the last one in brings the ship in');
});
