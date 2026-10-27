// The record book's page turn frames (record book plan step B,
// pageturn.js): BOOK.frames even steps from flat to turned away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnFrame } from '../js/pageturn.js';

test('the turn starts flat and ends turned away', () => {
  assert.equal(turnFrame(0, 11), 0);
  assert.equal(turnFrame(0.999, 11), 1);
});

test('the turn moves in 11 even steps', () => {
  const steps = new Set();
  for (let p = 0; p < 1; p += 0.001) steps.add(turnFrame(p, 11));
  assert.equal(steps.size, 11);
  assert.equal(turnFrame(0.5, 11), 0.5);
});
