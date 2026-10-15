// Unit tests for desk.js (the reflective desk): healing to full once a
// floor, a bump at full keeping the heal, and where it goes down.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { placeDesk, useDesk } from '../js/desk.js';

// Stability as given, and a fresh unused desk.
function resetFloor(hearts, maxHearts = 3) {
  state.run.hearts = hearts;
  state.run.maxHearts = maxHearts;
  return { row: 2, col: 2, kind: 'desk', searched: false };
}

test('the desk heals to full and is spent', () => {
  const desk = resetFloor(1);
  assert.deepEqual(useDesk(desk), [{ type: 'deskHealed', healed: 2 }]);
  assert.equal(state.run.hearts, 3);
  assert.equal(desk.searched, true);
});

test('a bump at full stability keeps the heal for later', () => {
  const desk = resetFloor(3);
  assert.deepEqual(useDesk(desk), [{ type: 'deskUntouched' }]);
  assert.equal(desk.searched, false);
});

test('the desk heals up to a raised max stability', () => {
  const desk = resetFloor(2, 5);
  useDesk(desk);
  assert.equal(state.run.hearts, 5);
});

test('the desk goes in the start room, off taken tiles', () => {
  const cells = (r0, c0) => [0, 1, 2].flatMap(r => [0, 1, 2].map(c => ({ row: r0 + r, col: c0 + c })));
  const layout = {
    start: { row: 11, col: 11 },
    chambers: [{ floorCells: cells(1, 1) }, { floorCells: cells(10, 10) }],
  };
  const tried = [];
  const placer = { pick: (list) => { tried.push(...list); return list[0]; } };
  const desk = placeDesk(layout, placer, [{ row: 11, col: 11 }]);
  assert.equal(desk.kind, 'desk');
  assert.ok(tried.every(p => p.row >= 10 && p.col >= 10));
  assert.ok(!tried.some(p => key(p.row, p.col) === key(11, 11)));
});

test('no start room, no desk', () => {
  const layout = { start: { row: 0, col: 0 }, chambers: [] };
  assert.equal(placeDesk(layout, { pick: () => null }, []), null);
});
