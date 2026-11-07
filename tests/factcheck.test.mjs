// Unit tests for a teacher's file with facts (facts list plan step D):
// js/factcheck.js checkFacts, the object form of js/quiz.js
// parseListInput, and js/sets.js withFacts / saved facts. No DOM.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { checkFacts } from '../js/factcheck.js';
import { parseListInput } from '../js/quiz.js';
import { withFacts, saveSet, loadSavedSet, loadSavedFacts, listSavedSets } from '../js/sets.js';

const good = {
  entities: [
    { id: 'rj45', name: 'RJ45', type: 'connector' },
    { id: 'rj11', name: 'RJ11', type: 'connector' },
    { id: 'db9', name: 'DB9', type: 'connector' },
  ],
  facts: [
    { subject: 'rj45', predicate: 'pin_count', object: 8 },
    { subject: 'rj11', predicate: 'pin_count', object: 6 },
    { subject: 'db9', predicate: 'pin_count', object: 9 },
  ],
  templates: [{ predicate: 'pin_count', ask_object: 'How many pins does {subject} have?', exhaustive: ['ask_object'] }],
};

const texts = problems => problems.map(p => p.text);

test('a good file has no problems and keeps every row', () => {
  const { clean, problems } = checkFacts(good);
  assert.deepEqual(problems, []);
  assert.equal(clean.entities.length, 3);
  assert.equal(clean.facts.length, 3);
  assert.equal(clean.templates.length, 1);
});

test('each broken row is skipped and named with its row and reason', () => {
  const { clean, problems } = checkFacts({
    entities: [
      ...good.entities,
      { name: 'No id' },
      { id: 'rj45', name: 'Second RJ45', type: 'connector' },
      { id: 'lc', type: 'connector' },
    ],
    facts: [
      ...good.facts,
      { subject: 'rj54', predicate: 'pin_count', object: 8 },
      { subject: 'rj45', predicate: 'pin_count', object: '4' },
      { subject: 'rj45', object: 8 },
      { subject: 'rj45', predicate: 'pin_count', object: 8 },
      { subject: 'rj45', predicate: 'used_by', object: 'ethernet' },
      { subject: 'lc', predicate: 'pin_count', object: 2 },
    ],
  });
  const skipped = texts(problems.filter(p => p.skipped));
  assert.deepEqual(skipped, [
    'entity #4: no "id"; skipped',
    'entity #5: id "rj45" is already entity #1; skipped',
    'entity #6 "lc": no "name"; skipped, and every fact that uses it',
    'fact #4: subject "rj54" is not an entity id; skipped',
    'fact #5: object "4" has quotes; write 4 without quotes; skipped',
    'fact #6: no "predicate"; skipped',
    'fact #7: same as fact #1; skipped',
    'fact #8: object "ethernet" is not an entity id or a number; skipped',
    'fact #9: subject "lc" is entity #6, which was skipped; skipped',
  ]);
  assert.deepEqual(clean.facts, good.facts);
  assert.equal(clean.entities.find(e => e.id === 'rj45').name, 'RJ45', 'the first entity with an id wins');
});

test('rows that would do nothing are kept with a warning', () => {
  const { clean, problems } = checkFacts({
    entities: [...good.entities, { id: 'vga', name: 'VGA', type: 'conector' }],
    facts: [...good.facts, { subject: 'rj45', predicate: 'pin_cont', object: 8 }],
    templates: [
      { predicate: 'pin_count', ask_object: 'How many pins does {subjct} have?', label: '{subject} pins' },
      { predicate: 'speed', ask_object: 'How fast is {subject}?' },
    ],
  });
  assert.ok(problems.every(p => !p.skipped));
  assert.deepEqual(texts(problems), [
    'template #1: "{subjct}" in "ask_object" is not {subject} or {object}; it shows as typed',
    'predicate "pin_cont" has no template, so its 1 fact makes no questions',
    'template #2: no fact uses predicate "speed"',
    'entity #4 "vga": no other entity has type "conector", so its questions have few wrong choices',
  ]);
  assert.equal(clean.facts.length, 4);
  assert.equal(clean.templates.length, 2);
});

test('a part that is not a list is skipped; a template needs a predicate', () => {
  const { problems } = checkFacts({ entities: {}, templates: [{ ask_object: 'x' }, { predicate: 'p' }, { predicate: 'p' }] });
  assert.deepEqual(texts(problems).slice(0, 3), [
    '"entities" must be a list [ ... ]; it is skipped',
    'template #1: no "predicate"; skipped',
    'template #3: predicate "p" already has template #2; skipped',
  ]);
});

test('the object form: questions, facts and their problems', () => {
  const result = parseListInput(JSON.stringify({
    questions: [{ question: 'RAM is what?', answer: 'Memory' }, { question: 'No answer' }],
    ...good,
    facts: [...good.facts, { subject: 'rj45', predicate: 'pin_count', object: '8' }],
  }));
  assert.equal(result.error, undefined);
  assert.equal(result.data.length, 1);
  assert.equal(result.facts.facts.length, 3);
  assert.deepEqual(texts(result.problems), [
    'question #2: needs both a "question" and an "answer"; skipped',
    'fact #4: object "8" has quotes; write 8 without quotes; skipped',
  ]);
});

test('every part is optional; a facts-only file makes its questions', () => {
  const result = parseListInput(JSON.stringify(good));
  assert.deepEqual(result.data, []);
  const set = withFacts(result.data, result.facts);
  assert.equal(set.data.length, 3);
  assert.ok(set.data.every(q => q.generated));
  assert.deepEqual(set.facts.map(f => f.value), [8, 6, 9]);
});

test('an object with no known part is an error; a plain array plays as before', () => {
  assert.ok(parseListInput('{"stuff": []}').error);
  assert.ok(parseListInput('{"facts": [').error);
  const plain = parseListInput(JSON.stringify([{ question: 'A', answer: '1' }, { question: 'B', answer: '2' }, { question: 'C' }]));
  assert.equal(plain.data.length, 2);
  assert.equal(plain.facts, undefined);
  assert.deepEqual(texts(plain.problems), ['question #3: needs both a "question" and an "answer"; skipped']);
});

test('the workshop help example loads with no problems and makes questions', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const example = html.match(/<pre>([\s\S]*?)<\/pre>/)[1];
  const result = parseListInput(example);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.problems, []);
  const set = withFacts(result.data, result.facts);
  assert.ok(set.data.length >= 3, 'its written question plus questions from its facts');
});

test('a saved set keeps its facts parts', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  try {
    saveSet('Ports', [{ question: 'RAM is what?', answer: 'Memory' }], good);
    saveSet('Plain', [{ question: 'A', answer: '1' }, { question: 'B', answer: '2' }]);
    assert.deepEqual(loadSavedFacts('Ports'), good);
    assert.equal(loadSavedFacts('Plain'), null);
    assert.equal(loadSavedSet('Ports').length, 1);
    const counts = Object.fromEntries(listSavedSets().map(s => [s.name, s.count]));
    assert.deepEqual(counts, { Ports: 4, Plain: 2 });
  } finally {
    delete globalThis.localStorage;
  }
});
