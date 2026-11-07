// Unit tests for the facts generator (js/factgen.js generateQuestions;
// facts list plan step C2) and for `acceptedAnswers` on question rows
// (js/quiz.js rightAnswers, buildChoices, parseListInput). No DOM.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { generateQuestions } from '../js/factgen.js';
import { buildChoices, rightAnswers, parseListInput } from '../js/quiz.js';
import { minigamesFor } from '../js/minigames.js';
import { state } from '../js/state.js';
import { FACT_QUESTIONS } from '../js/config.js';
import { withRandom } from './helpers.mjs';

const family = {
  entities: [
    { id: 'jesse', name: 'Jesse', type: 'name' },
    { id: 'david', name: 'David', type: 'name' },
    { id: 'saul', name: 'Saul', type: 'name' },
    { id: 'michal', name: 'Michal', type: 'name' },
    { id: 'amnon', name: 'Amnon', type: 'name' },
    { id: 'absalom', name: 'Absalom', type: 'name' },
    { id: 'solomon', name: 'Solomon', type: 'name', aliases: ['Jedidiah'] },
    { id: 'ruth', name: 'Ruth', type: 'name' },
    { id: 'boaz', name: 'Boaz', type: 'name' },
    { id: 'naomi', name: 'Naomi', type: 'name' },
    { id: 'bethlehem', name: 'Bethlehem', type: 'location' },
  ],
  facts: [
    { subject: 'jesse', predicate: 'father_of', object: 'david', source: 'Ruth 4:22' },
    { subject: 'david', predicate: 'father_of', object: 'amnon', source: '2 Sam 3:2' },
    { subject: 'david', predicate: 'father_of', object: 'absalom', source: '2 Sam 3:3' },
    { subject: 'david', predicate: 'father_of', object: 'solomon', source: '2 Sam 12:24' },
    { subject: 'saul', predicate: 'father_of', object: 'michal' },
    { subject: 'david', predicate: 'married', object: 'michal' },
    { subject: 'david', predicate: 'born_in', object: 'bethlehem' },
  ],
  templates: [
    { predicate: 'father_of', ask_object: 'Name a child of {subject}.', ask_subject: 'Who was the father of {object}?', exhaustive: ['ask_subject'] },
    { predicate: 'born_in', ask_subject: 'Who was born in {object}?', category: 'OT', difficulty: 'hard' },
  ],
};

const ask = (rows, question) => rows.find(r => r.question === question);

test('ask_object groups by subject: one question per subject, all its answers accepted', () => {
  const rows = generateQuestions(family);
  const david = rows.filter(r => r.question === 'Name a child of David.');
  assert.equal(david.length, 1);
  assert.equal(david[0].answer, 'Amnon'); // the first fact in file order
  assert.deepEqual(david[0].acceptedAnswers, ['Amnon', 'Absalom', 'Solomon', 'Jedidiah']);
  assert.equal(david[0].source, '2 Sam 3:2; 2 Sam 3:3; 2 Sam 12:24');
  assert.equal(david[0].generated, true);
  assert.equal(david[0].answerType, 'name');
});

test('ask_subject groups by object, and prompts use names, never ids', () => {
  const rows = generateQuestions(family);
  const q = ask(rows, 'Who was the father of Solomon?');
  assert.equal(q.answer, 'David');
  assert.ok(rows.every(r => !/\b(jesse|david|solomon|bethlehem)\b/.test(r.question)));
  assert.ok(!rows.some(r => r.question.includes('{')));
});

test('a generated row keeps the triples it came from (ids) and the side it asks, for DATA.SYS', () => {
  const rows = generateQuestions(family);
  assert.deepEqual(ask(rows, 'Who was the father of Solomon?').fromFacts, [
    { subject: 'david', predicate: 'father_of', object: 'solomon', asks: 'subject' },
  ]);
  const david = ask(rows, 'Name a child of David.').fromFacts;
  assert.deepEqual(david.map(f => f.object), ['amnon', 'absalom', 'solomon']);
  assert.ok(david.every(f => f.subject === 'david' && f.asks === 'object'));
});

test('a predicate with no template, or a template with neither ask, makes no questions', () => {
  const rows = generateQuestions(family);
  assert.ok(!rows.some(r => /michal/i.test(r.question) && /wife/i.test(r.question)));
  const none = generateQuestions({ ...family, templates: [{ predicate: 'father_of', label: '{object}\'s father' }] });
  assert.deepEqual(none, []);
});

test('category and difficulty come from the template, else the defaults', () => {
  const rows = generateQuestions(family);
  const child = ask(rows, 'Name a child of David.');
  assert.equal(child.category, FACT_QUESTIONS.category);
  assert.equal(child.difficulty, FACT_QUESTIONS.difficulty);
  const born = ask(rows, 'Who was born in Bethlehem?');
  assert.equal(born.category, 'OT');
  assert.equal(born.difficulty, 'hard');
});

test('wrong answers are never right, never linked to the subject, and keep to its type', () => {
  const rows = generateQuestions(family);
  const q = ask(rows, 'Name a child of David.');
  const wrong = q.wrongTiers.flat();
  // Michal is linked to David (his wife), Jesse is his father: neither is offered.
  assert.ok(!wrong.includes('Michal'));
  assert.ok(!wrong.includes('Jesse'));
  assert.ok(!wrong.some(w => q.acceptedAnswers.includes(w)));
  assert.ok(!wrong.includes('Bethlehem'));
  // Same predicate first: David is a father_of object, but linked; Ruth comes second.
  assert.deepEqual(q.wrongTiers[0], []);
  assert.deepEqual(q.wrongTiers[1], ['Saul', 'Ruth', 'Boaz', 'Naomi']);
});

test('a generated row is an open list unless its template calls that way exhaustive', () => {
  const rows = generateQuestions(family);
  assert.equal(ask(rows, 'Name a child of David.').openList, true);
  assert.equal(ask(rows, 'Who was born in Bethlehem?').openList, true);
  assert.equal(ask(rows, 'Who was the father of Solomon?').openList, undefined);
});

test('an open list with fewer than openMinWrong wrong answers from its file is left out', () => {
  const few = {
    entities: [{ id: 'saul', name: 'Saul', type: 'name' }, { id: 'michal', name: 'Michal', type: 'name' }, { id: 'ruth', name: 'Ruth', type: 'name' }],
    facts: [{ subject: 'saul', predicate: 'father_of', object: 'michal' }],
    templates: [{ predicate: 'father_of', ask_object: 'Name a child of {subject}.', ask_subject: 'Who was the father of {object}?', exhaustive: ['ask_subject'] }],
  };
  const rows = generateQuestions(few);
  assert.ok(!rows.some(r => r.question === 'Name a child of Saul.'));
  // The closed way has no such floor: buildChoices may fill it from the set.
  assert.ok(rows.some(r => r.question === 'Who was the father of Michal?'));
});

test('an open list fits no minigame and takes wrong choices from its file only', () => {
  const rows = generateQuestions(family);
  const open = ask(rows, 'Name a child of David.');
  assert.deepEqual(minigamesFor(open), []);
  state.settings.activeDictionary = [{ term: 'Jonathan', type: 'name' }, { term: 'Mephibosheth', type: 'name' }];
  state.settings.activeData = [...rows, { question: 'Who was Saul\'s eldest son?', answer: 'Jonathan', answerType: 'name' }];
  const fromFile = new Set(['Amnon', ...open.wrongTiers.flat()]);
  for (let i = 0; i < 30; i++) assert.ok(buildChoices(open).every(c => fromFile.has(c)));
  state.settings.activeDictionary = null;
});

test('a written question with the same text stays, and the generated one is left out', () => {
  const written = [{ question: 'Who was the father of David?', answer: 'Jesse' }];
  const rows = generateQuestions(family, written);
  assert.ok(!rows.some(r => r.question === 'Who was the father of David?'));
  assert.ok(rows.some(r => r.question === 'Who was the father of Solomon?'));
});

test('an old plain-array facts file, or no file, makes no questions', () => {
  assert.deepEqual(generateQuestions([{ fact: 'x', value: 3 }]), []);
  assert.deepEqual(generateQuestions(null), []);
});

const ports = {
  entities: [
    { id: 'https', name: 'HTTPS', type: 'protocol' },
    { id: 'http', name: 'HTTP', type: 'protocol' },
    { id: 'ssh', name: 'SSH', type: 'protocol' },
  ],
  facts: [
    { subject: 'https', predicate: 'uses_port', object: 443 },
    { subject: 'http', predicate: 'uses_port', object: 80 },
    { subject: 'ssh', predicate: 'uses_port', object: 22 },
  ],
  templates: [{ predicate: 'uses_port', max: 445, exhaustive: ['ask_subject'],
    ask_object: 'Which port does {subject} use by default?',
    ask_subject: 'Which protocol uses port {object} by default?' }],
};

test('number answers: real values of the predicate first, then the set\'s, made-up last', () => {
  const written = [{ question: 'How many pins?', answer: '8', answerType: 'number' }];
  const rows = generateQuestions(ports, written);
  const q = ask(rows, 'Which port does HTTPS use by default?');
  assert.equal(q.answer, '443');
  assert.equal(q.answerType, 'number');
  assert.deepEqual(q.wrongTiers[0], ['80', '22']);
  assert.deepEqual(q.wrongTiers[1], ['8']);
  const madeUp = q.wrongTiers[2].map(Number);
  assert.equal(madeUp.length, FACT_QUESTIONS.madeUpCount);
  assert.ok(madeUp.every(n => Number.isInteger(n) && n >= 1 && n <= 445 && n !== 443 && Math.abs(n - 443) <= 111));
  const back = ask(rows, 'Which protocol uses port 443 by default?');
  assert.equal(back.answer, 'HTTPS');
  assert.deepEqual([...back.wrongTiers[0]].sort(), ['HTTP', 'SSH']);
});

test('made-up numbers stay at 1 or more and within the template bounds', () => {
  const small = {
    entities: [{ id: 'a', name: 'A', type: 'name' }],
    facts: [{ subject: 'a', predicate: 'count', object: 1 }],
    templates: [{ predicate: 'count', ask_object: 'How many for {subject}?', max: 3, exhaustive: ['ask_object'] }],
  };
  const [q] = withRandom(0.5, () => generateQuestions(small));
  assert.deepEqual([...q.wrongTiers[2]].sort(), ['2']);
});

test('buildChoices never offers another right answer, and fills from wrongTiers first', () => {
  const rows = generateQuestions(family);
  state.settings.activeDictionary = null;
  state.settings.activeData = [
    ...rows,
    { question: 'Who killed Amnon\'s killer\'s horse?', answer: 'Absalom', answerType: 'name' },
    { question: 'Who wrote Psalm 23?', answer: 'Solomon', answerType: 'name' },
  ];
  const q = ask(rows, 'Name a child of David.');
  for (let i = 0; i < 30; i++) {
    const choices = buildChoices(q);
    assert.ok(choices.includes('Amnon'));
    assert.ok(!choices.some(c => c !== 'Amnon' && q.acceptedAnswers.includes(c)), choices.join(' | '));
  }
});

test('rightAnswers holds the answer and every accepted answer, case and spaces aside', () => {
  const keys = rightAnswers({ answer: 'Amnon', acceptedAnswers: ['Absalom', '  Jedidiah '] });
  assert.ok(keys.has('amnon') && keys.has('absalom') && keys.has('jedidiah'));
  assert.equal(rightAnswers({ answer: 'Ruth' }).size, 1);
});

test('the parser keeps acceptedAnswers on a written row', () => {
  const { data } = parseListInput(JSON.stringify([
    { question: 'Name a son of David.', answer: 'Solomon', acceptedAnswers: ['Absalom', ' ', 'Amnon'] },
    { question: 'Who was Ruth\'s husband?', answer: 'Boaz' },
  ]));
  assert.deepEqual(data[0].acceptedAnswers, ['Absalom', 'Amnon']);
  assert.equal(data[1].acceptedAnswers, undefined);
});

test('the Bible facts file makes the family trial questions, none a written one', () => {
  const written = JSON.parse(readFileSync(new URL('../lists/bible-quiz-bowl.json', import.meta.url)));
  const file = JSON.parse(readFileSync(new URL('../lists/facts/bible-quiz-bowl.json', import.meta.url)));
  const rows = generateQuestions(file, written);
  assert.equal(rows.length, 36);
  assert.ok(rows.filter(r => r.question.startsWith('Who was the')).every(r => !r.openList));
  assert.ok(rows.filter(r => r.question.startsWith('Name a')).every(r => r.openList));
  const keys = new Set(written.map(q => q.question.toLowerCase()));
  assert.ok(rows.every(r => !keys.has(r.question.toLowerCase())));
  const david = ask(rows, 'Name a child of David.');
  assert.deepEqual(david.acceptedAnswers, ['Amnon', 'Absalom', 'Adonijah', 'Solomon', 'Jedidiah']);
  // The written set itself is untouched: switching generated questions off gives it back exactly.
  assert.equal(written.filter(q => q.generated).length, 0);
});
