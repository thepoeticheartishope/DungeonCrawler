// The light tube's cells (record book plan step A, tubeart.js): one cell a
// charge, filled from the bottom, the cell being spent part-way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tubeCells } from '../js/tubeart.js';

test('a full battery fills every cell', () => {
  assert.deepEqual(tubeCells(4, 4), [1, 1, 1, 1]);
});

test('the cell being spent shows part-way, the ones above it empty', () => {
  assert.deepEqual(tubeCells(2.5, 4), [1, 1, 0.5, 0]);
});

test('an empty battery shows no cells', () => {
  assert.deepEqual(tubeCells(0, 4), [0, 0, 0, 0]);
});
