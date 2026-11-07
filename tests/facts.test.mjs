// Unit tests for reading a set's facts file (js/sets.js factsFromTriples,
// cleanFacts; facts list plan step C1). No DOM.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { factsFromTriples, cleanFacts } from '../js/sets.js';

const file = {
  entities: [
    { id: 'moses', name: 'Moses', type: 'name' },
    { id: 'david', name: 'David', type: 'name' },
    { id: 'solomon', name: 'Solomon', type: 'name' },
  ],
  facts: [
    { subject: 'moses', predicate: 'days_on_mountain', object: 40, source: 'Ex 24:18' },
    { subject: 'david', predicate: 'father_of', object: 'solomon' },
    { subject: 'david', predicate: 'age_at_crowning', object: 30 },
  ],
  templates: [{ predicate: 'days_on_mountain', label: 'Days {subject} spent on the mountain' }],
};

test('a triple reads as { fact, value, source } with its template label', () => {
  const { facts, skipped } = factsFromTriples(file);
  assert.equal(skipped, 0);
  assert.deepEqual(facts[0], { fact: 'Days Moses spent on the mountain', value: 40, source: 'Ex 24:18' });
});

test('no template: the label is the subject name and the predicate with spaces', () => {
  const { facts } = factsFromTriples(file);
  assert.equal(facts[2].fact, 'David age at crowning');
  assert.equal(facts[2].value, 30);
});

test('an entity object reads as its name, never its id', () => {
  const { facts } = factsFromTriples(file);
  assert.equal(facts[1].value, 'Solomon');
  assert.equal(facts[1].fact, 'David father of');
});

test('{object} in a label is filled in by name', () => {
  const { facts } = factsFromTriples({ ...file, templates: [{ predicate: 'father_of', label: '{object}\'s father' }] });
  assert.equal(facts[1].fact, 'Solomon\'s father');
});

test('facts with unknown ids or no predicate are skipped and counted', () => {
  const { facts, skipped } = factsFromTriples({
    entities: file.entities,
    facts: [
      { subject: 'goliath', predicate: 'height', object: 6 },
      { subject: 'david', predicate: 'father_of', object: 'absalom' },
      { subject: 'david', object: 3 },
      null,
      { subject: 'moses', predicate: 'days_on_mountain', object: 40 },
    ],
  });
  assert.equal(facts.length, 1);
  assert.equal(skipped, 4);
});

test('a file with no parts gives no facts', () => {
  assert.deepEqual(factsFromTriples({}), { facts: [], skipped: 0 });
});

test('an old plain list still reads (step B files)', () => {
  assert.deepEqual(cleanFacts([{ fact: 'Elders around the throne', value: 24 }]), [{ fact: 'Elders around the throne', value: 24 }]);
});

test('the Bible facts file gives the 20 Inference facts with the same values as v396', () => {
  const data = JSON.parse(readFileSync(new URL('../lists/facts/bible-quiz-bowl.json', import.meta.url), 'utf8'));
  const { facts: all, skipped } = factsFromTriples(data);
  assert.equal(skipped, 0);
  // Inference reads only the number facts; the David's family trial
  // (step C2) adds name facts, which it leaves alone.
  const facts = all.filter(f => typeof f.value === 'number');
  assert.deepEqual(facts.map(f => f.value), [5, 70, 9, 50, 17, 20, 13, 30, 8, 7, 90, 100, 3, 21, 4, 12, 39, 24, 19, 40]);
  assert.ok(facts.every(f => Number.isInteger(f.value) && f.value >= 1));
  assert.ok(facts.some(f => f.fact === 'Days Moses spent on the mountain' && f.source === 'Ex 24:18'));
});
