// Unit tests for wires.js (charger plan step A; the ship's stations use
// it since the charger went in dungeon removal step C): the wires, the
// power, and the turn every second wire turn.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeWires, powered, rotated, solveWires, turnWire, N, E, S, W } from '../js/wires.js';

// A small seeded random, so a failing case can be run again.
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
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

test('every second wire turn spends a turn', () => {
  const holder = { puzzle: makeWires(4, seeded(3)) };
  // Turning one wire round four times leaves the wires as they were, never solved.
  const spent = [0, 0, 0, 0].map(() => turnWire(holder, 0, () => []).some(e => e.type === 'turnSpent'));
  assert.deepEqual(spent, [false, true, false, true]);
});

test('a wire turn with no wires open does nothing', () => {
  assert.deepEqual(turnWire({ puzzle: null }, 0, () => []), []);
});
