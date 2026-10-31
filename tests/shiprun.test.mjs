// Unit tests for the ship's run (ship plan step C; ship.js, and how
// stations.js feeds it): a fresh run is calm with the clock full and a
// tragedy every part of which has wording; a failure raises the panic and
// Broken ends the run; three right answers in a row calm it; the panic
// makes the crew's game harder (shorter burns, slipping wires, the Timer);
// the arrival clock running out ends the run; a training period ends with
// the role learned; a missed burn window is a failure; the last burn
// arrives.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { SHIP_RUN, TRAGEDY_PARTS } from '../js/config.js';
import { TEXT } from '../js/text.js';
import {
  freshShipRun, rollTragedy, crewMissed, crewRight, burnMade, burnMs, slipEveryMs, breakerModifiers, shipFrame,
} from '../js/ship.js';
import { useStation, settleBreaker, stationDone } from '../js/stations.js';
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

test('a fresh run is calm, the clock full, nothing trained, and its tragedy all has wording', () => {
  const ship = shipRun();
  assert.equal(ship.panic, 0);
  assert.equal(ship.clockMs, SHIP_RUN.missionMs);
  assert.deepEqual(state.run.trained, []);
  assert.equal(state.run.burns, 0);
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

test('the panic makes the game harder: shorter burns, slipping wires, then the Timer', () => {
  const ship = shipRun();
  assert.equal(burnMs(), SHIP_RUN.burnMs);
  assert.equal(slipEveryMs(), 0);
  assert.deepEqual(breakerModifiers(), []);
  ship.panic = 1;
  assert.equal(burnMs(), SHIP_RUN.burnMs - SHIP_RUN.uneasyCutMs);
  ship.panic = 2;
  assert.equal(slipEveryMs(), SHIP_RUN.slipEveryMs[2]);
  assert.deepEqual(breakerModifiers(), []);
  ship.panic = SHIP_RUN.timerAt;
  assert.deepEqual(breakerModifiers(), ['timer']);
});

test('the arrival clock running out ends the run', () => {
  const ship = shipRun();
  assert.deepEqual(shipFrame(SHIP_RUN.missionMs - 1), []);
  assert.deepEqual(shipFrame(5), [{ type: 'shipEnded', how: 'clock' }]);
  assert.equal(ship.clockMs, 0);
});

test('the console starts a training period once; when it ends the role is learned', () => {
  const ship = shipRun();
  useStation(prop('console'));
  assert.deepEqual(ship.training, { role: 'engineer', leftMs: SHIP_RUN.trainMs });
  useStation(prop('console'));
  shipFrame(SHIP_RUN.trainMs - 10);
  assert.deepEqual(shipFrame(20), [{ type: 'trainingOver', role: 'engineer' }]);
  assert.deepEqual(state.run.trained, ['engineer']);
  assert.equal(ship.training, null);
});

test('a teaching miss raises the panic; a training miss does not', () => {
  const ship = shipRun();
  useStation(prop('console'));
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

test('a board opens with a burn window; missed, its wires clear and it is a failure', () => {
  const ship = shipRun();
  state.run.trained.push('engineer');
  ship.panic = 1;
  useStation(prop('powerBoard'));
  assert.equal(prop('powerBoard').burnLeftMs, SHIP_RUN.burnMs - SHIP_RUN.uneasyCutMs);
  ship.panic = 0;
  const events = shipFrame(SHIP_RUN.burnMs);
  assert.deepEqual(events.map(e => e.type), ['burnMissed', 'panicRose']);
  assert.equal(prop('powerBoard').puzzle, null);
});

test('a Shaken crew slips a powered wire every so often while a burn is on', () => {
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

test('the last burn arrives', () => {
  shipRun();
  state.run.trained.push('engineer');
  const board = prop('powerBoard');
  for (let i = 1; i < SHIP_RUN.burnsNeeded; i++) {
    useStation(board);
    assert.deepEqual(stationDone(board).map(e => e.type), ['burnDone']);
  }
  useStation(board);
  assert.deepEqual(stationDone(board).map(e => e.type), ['burnDone', 'shipEnded']);
  assert.deepEqual(burnMade(), [{ type: 'shipEnded', how: 'arrived' }]);
});
