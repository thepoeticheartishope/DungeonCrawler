// Unit tests for charger.js (charger plan step A): the wires, the power,
// the turn every second wire turn, the charge to full, and where it goes.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { CHARGER, ENERGY_MAX, LIGHT_BATTERY_MAX } from '../js/config.js';
import { freshLight } from '../js/battery.js';
import { makeWires, powered, rotated, solveWires, wireSize, placeCharger, useCharger, turnWire, chargerLine, N, E, S, W } from '../js/charger.js';

// A small seeded random, so a failing case can be run again.
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// Energy as given, plain rounds, and a fresh charger.
function resetRun(energy, depth = 0) {
  state.settings.lightBattery = true;
  state.settings.simpleEnemies = false;
  state.floor.light = freshLight();
  state.run.energy = energy;
  state.run.rounds = Array(energy).fill(null);
  state.run.roomIndex = depth;
  return { row: 2, col: 2, kind: 'charger', identified: false, searched: false, sprung: false };
}

test('a wire turns a quarter clockwise', () => {
  assert.equal(rotated(N), E);
  assert.equal(rotated(W), N);
  assert.equal(rotated(N | E), E | S);
  assert.equal(rotated(rotated(rotated(rotated(N | E | S)))), N | E | S);
});

test('power runs along joined wires only', () => {
  // 2 x 2: PWR on row 0, CELL on row 1. A bend down, then a bend out right.
  const puzzle = { n: 2, from: 0, to: 1, wires: [W | S, N | S, N | E, W | E] };
  assert.deepEqual([...powered(puzzle).on].sort(), [0, 2, 3]);
  assert.equal(powered(puzzle).done, true);
  puzzle.wires[0] = W | E; // turned away: power stops at the first wire
  assert.deepEqual([...powered(puzzle).on], [0]);
  assert.equal(powered(puzzle).done, false);
  puzzle.wires[0] = N | S; // no end on the left edge: no power at all
  assert.equal(powered(puzzle).on.size, 0);
});

test('new wires never start solved, and can always be solved', () => {
  for (const n of [4, 5]) {
    for (let seed = 1; seed <= 200; seed++) {
      const puzzle = makeWires(n, seeded(seed));
      assert.equal(puzzle.wires.length, n * n);
      assert.equal(powered(puzzle).done, false, `n ${n} seed ${seed} started solved`);
      const turns = solveWires(puzzle);
      assert.ok(turns, `n ${n} seed ${seed} has no way through`);
      turns.forEach(i => { puzzle.wires[i] = rotated(puzzle.wires[i]); });
      assert.equal(powered(puzzle).done, true, `n ${n} seed ${seed} solver failed`);
    }
  }
});

test('4 x 4 on depth 1, 5 x 5 from depth 2 down', () => {
  resetRun(0, 0);
  assert.equal(wireSize(), 4);
  resetRun(0, 1);
  assert.equal(wireSize(), 5);
  resetRun(0, 4);
  assert.equal(wireSize(), CHARGER.sizes.at(-1));
});

test('at full energy the charger does not open', () => {
  const charger = resetRun(ENERGY_MAX);
  assert.deepEqual(useCharger(charger), [{ type: 'chargerFull' }]);
  assert.equal(charger.puzzle, undefined);
});

test('opening it gives new wires; leaving keeps them as they were', () => {
  const charger = resetRun(1, 1);
  assert.deepEqual(useCharger(charger, seeded(7)), [{ type: 'chargerOpened', charger, kept: false }]);
  assert.equal(charger.puzzle.n, 5);
  turnWire(charger, 3);
  const left = charger.puzzle.wires.slice();
  assert.deepEqual(useCharger(charger, seeded(8)), [{ type: 'chargerOpened', charger, kept: true }]);
  assert.deepEqual(charger.puzzle.wires, left);
  assert.equal(charger.puzzle.turns, 1);
});

test('every second wire turn spends a turn', () => {
  const charger = resetRun(0);
  useCharger(charger, seeded(3));
  // Turning one wire round four times leaves the wires as they were, never solved.
  const spent = [0, 0, 0, 0].map(() => turnWire(charger, 0).some(e => e.type === 'turnSpent'));
  assert.deepEqual(spent, [false, true, false, true]);
});

test('joining power to the cell fills energy with plain rounds and clears the wires', () => {
  const charger = resetRun(1);
  state.run.rounds = ['Ports'];
  useCharger(charger, seeded(11));
  const turns = solveWires(charger.puzzle);
  let events = [];
  turns.forEach(i => { events = turnWire(charger, i); });
  assert.deepEqual(events.at(-1), { type: 'charged', gained: ENERGY_MAX - 1, light: false });
  assert.equal(state.run.energy, ENERGY_MAX);
  assert.deepEqual(state.run.rounds, ['Ports', ...Array(ENERGY_MAX - 1).fill(null)]);
  assert.equal(charger.puzzle, null);
  // The next use gets new wires.
  state.run.energy = 0;
  state.run.rounds = [];
  assert.deepEqual(useCharger(charger, seeded(12)), [{ type: 'chargerOpened', charger, kept: false }]);
});

test('a wire turn with no wires open does nothing', () => {
  const charger = resetRun(0);
  assert.deepEqual(turnWire(charger, 0), []);
});

test('the charger goes in the start room, off taken tiles', () => {
  const cells = (r0, c0) => [0, 1, 2].flatMap(r => [0, 1, 2].map(c => ({ row: r0 + r, col: c0 + c })));
  const layout = {
    start: { row: 11, col: 11 },
    chambers: [{ floorCells: cells(1, 1) }, { floorCells: cells(10, 10) }],
  };
  const tried = [];
  const placer = { pick: (list) => { tried.push(...list); return list[0]; } };
  const desk = { row: 10, col: 10 };
  const charger = placeCharger(layout, placer, [{ row: 11, col: 11 }, desk]);
  assert.equal(charger.kind, 'charger');
  assert.ok(tried.every(p => p.row >= 10 && p.col >= 10));
  assert.ok(!tried.some(p => key(p.row, p.col) === key(11, 11) || key(p.row, p.col) === key(10, 10)));
});

test('no start room, no charger', () => {
  const layout = { start: { row: 0, col: 0 }, chambers: [] };
  assert.equal(placeCharger(layout, { pick: () => null }, []), null);
});

test('the kind voice speaks once a run, when a charger is first made out', () => {
  state.run.chargerTold = false;
  const charger = { row: 2, col: 2, kind: 'charger', identified: false };
  state.floor.props = [charger];
  assert.deepEqual(chargerLine(), []);
  charger.identified = true;
  assert.deepEqual(chargerLine(), [{ type: 'whispered', line: 'tut.charger', tone: 'kind' }]);
  assert.deepEqual(chargerLine(), []);
  // A new floor's charger in the same run: no second line.
  state.floor.props = [{ ...charger }];
  assert.deepEqual(chargerLine(), []);
});

test("a charge fills the light's battery too, and a low battery alone opens it", () => {
  const charger = resetRun(ENERGY_MAX);
  assert.deepEqual(useCharger(charger, seeded(5)), [{ type: 'chargerFull' }], 'energy and light full: nothing to give');
  state.floor.light = { on: false, charge: 1, locked: true };
  const opened = useCharger(charger, seeded(5));
  assert.equal(opened[0].type, 'chargerOpened', 'a low battery is something to give');
  let events = [];
  solveWires(charger.puzzle).forEach(i => { events = turnWire(charger, i); });
  assert.deepEqual(events.at(-1), { type: 'charged', gained: 0, light: true });
  assert.equal(state.floor.light.charge, LIGHT_BATTERY_MAX);
  assert.equal(state.floor.light.locked, false);
});
