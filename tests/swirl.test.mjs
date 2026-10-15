// Unit tests for swirl.js, the answer ring (answer swirl plan step B): which
// answers are short enough to ring (letters and digits only count), how
// the answer repeats round it, and when the line shows instead (too long,
// reduced motion, Simple enemies, no tile). A move fades it, and a new
// floor takes it away.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { letterCount, ringFits, ringLetters, startAnswerRing, endAnswerRing, answerRingNow } from '../js/swirl.js';
import { ANSWER_RING_MAX_LETTERS, ANSWER_RING_MIN_CHARS, ANSWER_RING_OUT_MS } from '../js/config.js';

test('only letters and digits count toward a ring', () => {
  assert.equal(letterCount('GEN 6:14'), 6);
  assert.equal(letterCount('1 Kgs 17:6'), 7);
  assert.equal(letterCount('443'), 3);
});

test(`up to ${ANSWER_RING_MAX_LETTERS} letters rings, longer is the line`, () => {
  assert.ok(ringFits('Noah'));
  assert.ok(ringFits('x'.repeat(ANSWER_RING_MAX_LETTERS)));
  assert.ok(!ringFits('x'.repeat(ANSWER_RING_MAX_LETTERS + 1)));
  assert.ok(!ringFits('Walked on water to Jesus'));
  assert.ok(!ringFits(' : '));
});

test('the answer repeats round the ring with a dot between, never cut short', () => {
  const letters = ringLetters('Noah').join('');
  assert.ok(letters.length >= ANSWER_RING_MIN_CHARS);
  assert.equal(letters.length % 'Noah · '.length, 0);
  assert.ok(letters.startsWith('Noah · Noah · '));
  assert.equal(ringLetters('x'.repeat(ANSWER_RING_MIN_CHARS)).join(''), 'x'.repeat(ANSWER_RING_MIN_CHARS) + ' · ');
});

test('the line shows instead when the answer is long, motion is reduced, Simple enemies is on, or there is no tile', () => {
  state.settings.simpleEnemies = false;
  const at = { row: 3, col: 4 };
  assert.equal(startAnswerRing('Walked on water to Jesus', at, false, false, 0), false);
  assert.equal(startAnswerRing('Noah', at, false, true, 0), false);
  assert.equal(startAnswerRing('Noah', null, false, false, 0), false);
  state.settings.simpleEnemies = true;
  assert.equal(startAnswerRing('Noah', at, false, false, 0), false);
  state.settings.simpleEnemies = false;
});

test('a ring stays until a move, then fades out; a new one replaces it', () => {
  state.settings.simpleEnemies = false;
  state.run.floorsEntered = 1;
  assert.ok(startAnswerRing('Noah', { row: 3, col: 4 }, true, false, 1000));
  assert.deepEqual(answerRingNow(60000), { text: 'Noah', row: 3, col: 4, boss: true, since: 59000, fading: null });
  assert.ok(startAnswerRing('Moses', { row: 5, col: 6 }, false, false, 61000));
  assert.equal(answerRingNow(61000).text, 'Moses');
  endAnswerRing(62000);
  endAnswerRing(62500); // a second move doesn't restart the fade
  assert.equal(answerRingNow(62000 + ANSWER_RING_OUT_MS - 1).fading, ANSWER_RING_OUT_MS - 1);
  assert.equal(answerRingNow(62000 + ANSWER_RING_OUT_MS), null);
});

test('a new floor takes the ring away', () => {
  state.run.floorsEntered = 1;
  assert.ok(startAnswerRing('Noah', { row: 3, col: 4 }, false, false, 0));
  state.run.floorsEntered = 2;
  assert.equal(answerRingNow(10), null);
});
