// Unit tests for mastery.js (mastery plan step A; no DOM).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MASTERY } from '../js/config.js';
import { newMasteryRecord, masteryKey, masteryNext, masteryTier, masteryTask, masteryCounts, settleMastery } from '../js/mastery.js';

const q = (n) => ({ question: 'Question ' + n + '?', answer: 'Answer ' + n });
const DAY = 20000;
const types = events => events.map(e => e.type);

// Answers `item` right with `bet` until it moves up, on `today`.
function climb(record, item, bet, today = DAY) {
  let events = [];
  for (let i = 0; i < MASTERY.bar && !events.some(e => e.type === 'masteryMovedUp'); i++) {
    events = settleMastery(record, item, { bet, right: true }, today);
  }
  return events;
}

test('a right answer earns the bet, and no bet counts as Low', () => {
  const record = newMasteryRecord();
  const a = q(1);
  assert.deepEqual(settleMastery(record, a, { bet: 3, right: true }, DAY)[0],
    { type: 'masteryAnswered', right: true, credits: 3, score: 3, factCredits: 3 });
  const b = q(2);
  assert.equal(settleMastery(record, b, { bet: 0, right: true }, DAY)[0].credits, MASTERY.bets[0]);
  assert.equal(record.log.at(-1).bet, null, 'a skipped bet is logged as none');
});

test('a wrong answer takes the bet off the score, which may go below 0', () => {
  const record = newMasteryRecord();
  const events = settleMastery(record, q(1), { bet: 2, right: false }, DAY);
  assert.equal(events[0].credits, -2);
  assert.equal(record.score, -2);
  assert.equal(masteryTier(record, q(1)), 1, 'tier 1 has nowhere to drop');
});

test('reaching the bar moves a fact up and rests it by questions and days', () => {
  const record = newMasteryRecord();
  const a = q(1);
  const events = climb(record, a, 3);
  assert.deepEqual(types(events), ['masteryAnswered', 'masteryMovedUp']);
  // No evidence task yet (plan step B): tier 1 goes straight to 3.
  assert.equal(events[1].tier, 3);
  assert.equal(events[1].questions, MASTERY.rests[3].questions);
  assert.equal(events[1].days, MASTERY.rests[3].days);
  assert.equal(masteryTask(record, a), 3);
  assert.equal(masteryCounts(record, [a], DAY).resting, 1);
});

test('with an evidence task a fact moves from 1 to 2', () => {
  const record = newMasteryRecord();
  settleMastery(record, q(1), { bet: 3, right: true }, DAY, true);
  const events = settleMastery(record, q(1), { bet: 3, right: true }, DAY, true);
  assert.equal(events[1].tier, 2);
});

test('a miss drops one tier (3 to 1 without evidence) and clears credits', () => {
  const record = newMasteryRecord();
  const a = q(1);
  climb(record, a, 3);
  settleMastery(record, a, { bet: 2, right: true }, DAY + 9);
  const events = settleMastery(record, a, { bet: 1, right: false }, DAY + 9);
  assert.deepEqual(events[1], { type: 'masteryDropped', tier: 1 });
  assert.equal(events[0].factCredits, 0);
});

test('a mastered fact comes back as a typed check and rests longer each pass', () => {
  const record = newMasteryRecord();
  const a = q(1);
  climb(record, a, 3);
  const up = climb(record, a, 3, DAY + 9);
  assert.equal(up[1].tier, 4);
  assert.equal(masteryTask(record, a), 3);
  const first = settleMastery(record, a, { bet: 3, right: true }, DAY + 30);
  assert.deepEqual(first[1], { type: 'masteryKept', questions: MASTERY.rests[4].questions * 2, days: MASTERY.rests[4].days * 2 });
  const second = settleMastery(record, a, { bet: 3, right: true }, DAY + 60);
  assert.equal(second[1].days, MASTERY.rests[4].days * 3);
  const miss = settleMastery(record, a, { bet: 3, right: false }, DAY + 90);
  assert.deepEqual(miss[1], { type: 'masteryDropped', tier: 3 });
});

test('other facts count down their question rest; the day rest waits for the day', () => {
  const record = newMasteryRecord();
  const facts = [1, 2, 3, 4].map(q);
  climb(record, facts[0], 3);
  for (let i = 0; i < MASTERY.rests[3].questions; i++) settleMastery(record, facts[1 + (i % 3)], { bet: 1, right: true }, DAY);
  assert.equal(record.facts[masteryKey(facts[0])].restQuestions, 0);
  assert.equal(masteryCounts(record, [facts[0]], DAY).resting, 1, 'still waiting for its day');
  assert.equal(masteryCounts(record, [facts[0]], DAY + MASTERY.rests[3].days).learning, 1);
});

test('new facts join only while few are ready; then the weakest comes up', () => {
  const record = newMasteryRecord();
  const facts = Array.from({ length: MASTERY.activeFacts + 4 }, (_, i) => q(i));
  const met = new Set();
  for (let i = 0; i < MASTERY.activeFacts; i++) {
    const next = masteryNext(record, facts, DAY);
    assert.ok(!met.has(masteryKey(next)), 'a new fact while fewer than activeFacts are ready');
    met.add(masteryKey(next));
    settleMastery(record, next, { bet: 1, right: true }, DAY);
  }
  // Now activeFacts are ready: no new one, and never the one just asked.
  const weak = facts.find(f => met.has(masteryKey(f)) && masteryKey(f) !== record.last);
  settleMastery(record, weak, { bet: 1, right: false }, DAY);
  const before = record.last;
  record.facts[masteryKey(weak)].credits = 0;
  for (let i = 0; i < 10; i++) {
    const next = masteryNext(record, facts, DAY);
    assert.ok(met.has(masteryKey(next)));
    assert.notEqual(masteryKey(next), before);
  }
});

test('nothing to ask when every met fact rests on a later day and none is new', () => {
  const record = newMasteryRecord();
  const a = q(1);
  climb(record, a, 3);
  assert.equal(masteryNext(record, [a], DAY), null);
  // The day has come but no other question can pass: ask it anyway.
  assert.equal(masteryNext(record, [a], DAY + MASTERY.rests[3].days), a);
});

test('picture questions with one wording are different facts', () => {
  const a = { question: 'Which tool is shown?', answer: 'Crimper', image: 'a.svg' };
  const b = { question: 'Which tool is shown?', answer: 'Punchdown tool', image: 'b.svg' };
  assert.notEqual(masteryKey(a), masteryKey(b));
});
