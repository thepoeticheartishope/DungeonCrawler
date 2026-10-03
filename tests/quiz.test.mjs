// Unit tests for quiz.js answer choices (no DOM).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { buildChoices, numericAnswer, stemTypes } from '../js/quiz.js';

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

// ---- Subject dictionary (state.settings.activeDictionary) ----

const entry = (term, type, extra = {}) => ({ term, type, ...extra });

test('a small set draws its wrong answers from the dictionary', () => {
  const item = q('Who killed Goliath?', 'David', { answerType: 'name' });
  state.settings.activeData = [item, q('Which book?', 'Ruth', { answerType: 'book' })];
  state.settings.activeDictionary = [entry('David', 'name'), entry('Saul', 'name'), entry('Jonathan', 'name'),
    entry('Samuel', 'name'), entry('Ruth', 'book')];
  for (let i = 0; i < 20; i++) {
    const got = buildChoices(item);
    assert.equal(got.length, 4);
    assert.ok(!got.includes('Ruth'));
  }
  state.settings.activeDictionary = null;
});

test('descriptions are offered next to descriptions, plain names next to names', () => {
  const item = q('Who?', 'The gardener', { answerType: 'name' });
  state.settings.activeData = [item];
  state.settings.activeDictionary = [entry('The gardener', 'name', { description: true }),
    entry('The sons of thunder', 'name', { description: true }), entry('The moneychangers', 'name', { description: true }),
    entry('The house of Jehu', 'name', { description: true }), entry('Moses', 'name'), entry('Aaron', 'name')];
  for (let i = 0; i < 20; i++) {
    const got = buildChoices(item);
    assert.ok(!got.includes('Moses') && !got.includes('Aaron'));
  }
  state.settings.activeDictionary = null;
});

test('an aka spelling is never offered as a wrong answer, and is shown as its term', () => {
  const item = q('Whose city?', "David's", { answerType: 'name' });
  const other = q('Who?', "Benjamin's", { answerType: 'name' });
  state.settings.activeData = [item, other, q('Who?', 'David', { answerType: 'name' })];
  state.settings.activeDictionary = [entry('David', 'name', { aka: ["David's"] }), entry('Benjamin', 'name', { aka: ["Benjamin's"] })];
  for (let i = 0; i < 20; i++) {
    const got = buildChoices(item);
    assert.ok(!got.includes('David'));
    assert.ok(!got.includes("Benjamin's"));
    assert.ok(got.includes('Benjamin'));
  }
  state.settings.activeDictionary = null;
});

test('a type the dictionary is short of tops up from the set', () => {
  const item = q('Which verb?', 'Wept', { answerType: 'verb' });
  state.settings.activeData = [item, q('?', 'Ran', { answerType: 'verb' }), q('?', 'Slept', { answerType: 'verb' })];
  state.settings.activeDictionary = [entry('Wept', 'verb'), entry('Prayed', 'verb')];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(buildChoices(item).slice().sort(), ['Prayed', 'Ran', 'Slept', 'Wept']);
  }
  state.settings.activeDictionary = null;
});

test('dictionary numbers are offered nearest in size first', () => {
  const item = q('How many?', '40', { answerType: 'number' });
  state.settings.activeData = [item];
  state.settings.activeDictionary = ['1', '2', '3', '30', '40', '42', '50', '144000'].map(n => entry(n, 'number'));
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(buildChoices(item).slice().sort(), ['30', '40', '42', '50']);
  }
  state.settings.activeDictionary = null;
});

test('a person named through another gets wrong answers sharing a part first', () => {
  const item = q('Who was turned into a pillar of salt?', "Lot's wife", { answerType: 'related' });
  state.settings.activeData = [item];
  const rel = (term, of, relation) => entry(term, 'related', { of, relation });
  state.settings.activeDictionary = [rel("Lot's wife", 'Lot', 'wife'), rel("Lot's daughters", 'Lot', 'daughters'),
    rel("Job's wife", 'Job', 'wife'), rel("Noah's wife", 'Noah', 'wife'),
    rel("Jairus' daughter", 'Jairus', 'daughter'), rel("Pharaoh's daughter", 'Pharaoh', 'daughter')];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(buildChoices(item).slice().sort(), ["Job's wife", "Lot's daughters", "Lot's wife", "Noah's wife"]);
  }
  state.settings.activeDictionary = null;
});

test('a relation shared only by plural ("daughters") still counts', () => {
  const item = q('Who adopted Moses?', "Pharaoh's daughter", { answerType: 'related' });
  state.settings.activeData = [item];
  const rel = (term, of, relation) => entry(term, 'related', { of, relation });
  state.settings.activeDictionary = [rel("Pharaoh's daughter", 'Pharaoh', 'daughter'), rel("Lot's daughters", 'Lot', 'daughters'),
    rel("Jairus' daughter", 'Jairus', 'daughter'), rel("Jephthah's daughter", 'Jephthah', 'daughter'),
    rel("Job's wife", 'Job', 'wife'), rel("Noah's wife", 'Noah', 'wife')];
  for (let i = 0; i < 20; i++) {
    const got = buildChoices(item);
    assert.ok(!got.includes("Job's wife") && !got.includes("Noah's wife"));
  }
  state.settings.activeDictionary = null;
});

// ---- Stem lock (STEM_CUES in config.js) ----

test('stemTypes reads the first words of a question', () => {
  assert.ok(stemTypes('Who built the ark?').includes('name'));
  assert.ok(stemTypes('To whom did Paul write?').includes('relation'));
  assert.deepEqual(stemTypes('How many tribes?'), ['number']);
  assert.deepEqual(stemTypes('Which book follows Joel?'), ['book']);
  assert.deepEqual(stemTypes('Which verse says: "Jesus wept"?'), ['verse']);
  assert.deepEqual(stemTypes('Where was Jesus born?'), ['location']);
  assert.equal(stemTypes('In what book, chapter and verse is "heaven" first mentioned?'), null);
  assert.equal(stemTypes('What did Jesus eat?'), null);
  assert.equal(stemTypes('RAID 5'), null);
});

test('an untagged list takes its types from the stems', () => {
  const item = q('Who built the ark?', 'Noah');
  state.settings.activeData = [item, q('Who led Israel?', 'Moses'), q('Who was king?', 'Saul'),
    q('Whom did Ruth marry?', 'Boaz'), q('How many tribes?', '12'), q('Where was Jesus born?', 'Bethlehem'),
    q('What did he eat?', 'Locusts')];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(buildChoices(item).slice().sort(), ['Boaz', 'Moses', 'Noah', 'Saul']);
  }
});

test('a "Who" question short of its own type gets other people before places', () => {
  const item = q('Who was Caiaphas to Annas?', 'Son-in-law', { answerType: 'relation' });
  state.settings.activeData = [item, q('Who?', 'Brother', { answerType: 'relation' }),
    q('Who?', 'Moses', { answerType: 'name' }), q('Who?', 'Pharisees', { answerType: 'group' }),
    q('Where?', 'Bethel', { answerType: 'location' }), q('What?', 'Bread', { answerType: 'object' })];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(buildChoices(item).slice().sort(), ['Brother', 'Moses', 'Pharisees', 'Son-in-law']);
  }
});

test('the lock is soft: it tops up from outside rather than show fewer options', () => {
  const item = q('Who?', 'Moses', { answerType: 'name' });
  state.settings.activeData = [item, q('Who?', 'Aaron', { answerType: 'name' }),
    q('Where?', 'Bethel', { answerType: 'location' }), q('Where?', 'Egypt', { answerType: 'location' })];
  for (let i = 0; i < 20; i++) assert.equal(buildChoices(item).length, 4);
});

test('a tag the stem does not allow wins, and the stem is ignored', () => {
  const item = q('Who were Baalim and Ashtaroth?', 'False gods', { answerType: 'theology' });
  state.settings.activeData = [item, q('?', 'Grace', { answerType: 'theology' }), q('?', 'Faith', { answerType: 'theology' }),
    q('?', 'Hope', { answerType: 'theology' }), q('Who?', 'Moses', { answerType: 'name' })];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(buildChoices(item).slice().sort(), ['Faith', 'False gods', 'Grace', 'Hope']);
  }
});

test('an acronym question gets definitions of look-alike acronyms first', () => {
  const item = q('RAID', 'Redundant Array of Independent Disks', { answerType: 'term' });
  state.settings.activeData = [item];
  const term = (t, acronym) => entry(t, 'term', { acronym });
  state.settings.activeDictionary = [term('Redundant Array of Independent Disks', 'RAID'),
    term('Random-access Memory', 'RAM'), term('Rivest, Shamir, Adleman', 'RSA'), term('Remote Desktop Protocol', 'RDP'),
    term('Domain Name System', 'DNS'), term('Liquid Crystal Display', 'LCD'), term('Secure Shell', 'SSH')];
  for (let i = 0; i < 20; i++) {
    const got = buildChoices(item);
    assert.ok(got.includes('Random-access Memory'));
    assert.ok(got.every(c => c[0] === 'R'));
  }
  state.settings.activeDictionary = null;
});
