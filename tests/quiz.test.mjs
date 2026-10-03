// Unit tests for quiz.js answer choices (no DOM).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { buildChoices, numericAnswer } from '../js/quiz.js';

const q = (term, meaning, extra = {}) => ({ term, meaning, ...extra });

test('numericAnswer reads numbers, units and thousands commas', () => {
  assert.deepEqual(numericAnswer('144,000'), { value: 144000, unit: '' });
  assert.deepEqual(numericAnswer('8 GB'), { value: 8, unit: 'gb' });
  assert.deepEqual(numericAnswer('2.5'), { value: 2.5, unit: '' });
  assert.equal(numericAnswer('Moses'), null);
  assert.equal(numericAnswer('1 Corinthians 1:27'), null);
});

test('a typed number question gets the nearest numbers', () => {
  const item = q('How many?', '144000', { answerType: 'number' });
  state.settings.activeData = [item,
    ...['1', '2', '3', '7', '100000', '120000', '200000'].map(n => q('?', n, { answerType: 'number' }))];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(buildChoices(item).slice().sort(), ['100000', '120000', '144000', '200000']);
  }
});

test('an untyped list (any set) gets near numbers with the same unit', () => {
  const item = q('Gigabit Ethernet speed', '1000 Mbps');
  state.settings.activeData = [item, q('a', '100 Mbps'), q('b', '10 Mbps'), q('c', '10000 Mbps'),
    q('d', '1 Mbps'), q('e', '1000 GB'), q('f', 'DNS')];
  for (let i = 0; i < 20; i++) {
    const got = buildChoices(item);
    assert.ok(!got.includes('1000 GB') && !got.includes('DNS'));
  }
});

test('a bare-number answer typed as a term still gets near numbers', () => {
  const item = q('HTTPS port', '443', { answerType: 'term' });
  state.settings.activeData = [item, q('a', '80', { answerType: 'term' }), q('b', '22', { answerType: 'term' }),
    q('c', '3389', { answerType: 'term' }), q('d', '65535', { answerType: 'term' }), q('e', '110', { answerType: 'term' }),
    q('f', '53', { answerType: 'term' }), q('g', '25', { answerType: 'term' })];
  for (let i = 0; i < 20; i++) {
    assert.ok(!buildChoices(item).includes('65535'));
  }
});

test('a book that starts with a number is not a number question', () => {
  const item = q('Which book?', '1 Corinthians', { answerType: 'book' });
  state.settings.activeData = [item, ...['Genesis', 'Exodus', 'Romans', '2 Corinthians', 'Jude']
    .map(b => q('?', b, { answerType: 'book' }))];
  const seen = new Set();
  for (let i = 0; i < 200; i++) buildChoices(item).forEach(c => seen.add(c));
  assert.equal(seen.size, 6); // every book still turns up, not only 2 Corinthians
});

test('the same number written two ways is offered once, never as a wrong answer', () => {
  const item = q('How many sealed?', '144000', { answerType: 'number' });
  state.settings.activeData = [item, q('?', '144,000', { answerType: 'number' }),
    ...['12', '24', '1000', '12000'].map(n => q('?', n, { answerType: 'number' }))];
  for (let i = 0; i < 20; i++) assert.ok(!buildChoices(item).includes('144,000'));
});
