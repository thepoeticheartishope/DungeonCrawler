// Unit tests for bosschat.js (boss plan step C): the crew chat's priority
// pick, one line per move, who speaks, the light nudge that never gives
// Call's answer away, and the Dark hint ladder in minigames.js.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { MATCH_BOSS } from '../js/config.js';
import { t } from '../js/text.js';
import {
  matchGroups, matchSetup, matchSwap, matchEndTurn, matchNextPhase, matchHint, matchHintAt, matchFindMove, MATCH_CALL, MATCH_DARK,
} from '../js/minigames.js';
import { CHAT_ORDER, chatPick, moveLine, moveLines, phaseLine, wordNote } from '../js/bosschat.js';

const NOTE = 'Paul wrote to the church in Rome.';
const SET = [
  ...['Ruth', 'Acts', 'Jude', 'Amos', 'Joel', 'Ezra', 'Luke'].map(m => ({ question: 'Which book?', answer: m, answerType: 'book', note: 'A book called ' + m + '.' })),
  ...['Rome', 'Eden', 'Moab', 'Edom', 'Joppa', 'Nebo', 'Egypt'].map(m => ({ question: 'Where?', answer: m, answerType: 'location', note: m === 'Eden' ? NOTE : '' })),
  ...['Paul', 'Herod', 'Lot', 'Aaron', 'Silas', 'Jacob', 'Saul', 'Eli'].map(m => ({ question: 'Who?', answer: m, answerType: 'name' })),
];
const T = k => ({ kind: k, word: 'w' + k });
// No line anywhere: row r, column c holds kind (c + 2r) % 3.
const plain = () => Array.from({ length: 25 }, (_, i) => T(((i % 5) + 2 * Math.floor(i / 5)) % 3));

// A board on SET moved on to `phase`, its tiles the plain no-line pattern.
function boardAt(phase) {
  state.settings.activeData = SET;
  const board = matchSetup(matchGroups());
  for (let p = 0; p < phase; p++) matchNextPhase(board);
  board.cells = plain();
  return board;
}

// Every wording a line could come out as, with its vars filled plainly.
const words = line => t(line.key, { ...line.vars, kind: 'K', gains: '', ability: 'A' });

test('the chat picks one line by CHAT_ORDER: phase beat > answer > spread > ... > cheer', () => {
  assert.deepEqual(CHAT_ORDER.slice(0, 3), ['phase', 'answer', 'spread']);
  assert.ok(CHAT_ORDER.indexOf('miss') < CHAT_ORDER.indexOf('freed'));
  assert.deepEqual(CHAT_ORDER.slice(-4), ['freed', 'chain', 'charged', 'cheer']);
  const all = [...CHAT_ORDER].reverse().map(kind => ({ kind }));
  assert.equal(chatPick(all).kind, 'phase');
  assert.equal(chatPick([{ kind: 'cheer' }, { kind: 'spread' }, { kind: 'miss' }]).kind, 'spread');
  assert.equal(chatPick([]), null);
});

test('a move with several things to say says one: the cleared crisis, not the meter or the cheer', () => {
  const board = boardAt(0);
  board.cells.splice(0, 5, T(0), T(0), T(1), T(0), T(2));
  board.cells[7] = { kind: 'crisis', word: '!!' };
  board.charge = [MATCH_BOSS.full - 1, 0, 0];
  const chargeWas = [...board.charge];
  const got = matchSwap(board, 2, 3);
  const turn = matchEndTurn(board);
  const lines = moveLines(board, { got, turn, chargeWas });
  assert.ok(lines.length > 1, 'more than one thing to say');
  const line = moveLine(board, { got, turn, chargeWas });
  assert.deepEqual(line, chatPick(lines), 'exactly one line is said');
  assert.equal(line.kind, 'freed');
  assert.ok(lines.some(l => l.kind === 'charged' && l.slot === 0), 'the kind-0 crew member filled up');
  assert.ok(lines.some(l => l.kind === 'cheer'));
});

test('the spread warning comes one move before the crisis grows, once it is close to taking the ship', () => {
  const board = boardAt(0);
  board.cells.splice(0, 5, T(0), T(0), T(1), T(0), T(2));
  const got = matchSwap(board, 2, 3);
  const turn = matchEndTurn(board);
  assert.equal(board.toSpread, 1);
  assert.notEqual(moveLine(board, { got, turn }).kind, 'spread', 'not while the crisis is small');
  [20, 21, 22, 23, 24].forEach((k) => { board.cells[k] = { kind: 'crisis', word: '!!' }; });
  assert.ok(MATCH_BOSS.warnFrom <= 5);
  assert.equal(moveLine(board, { got, turn }).kind, 'spread');
  assert.equal(moveLine(board, { got, turn }).slot, 1, 'the crew member who holds it back');
  board.skip = 1;
  assert.notEqual(moveLine(board, { got, turn }).kind, 'spread', 'not when it is held back');
});

test('a miss: the moved-onto tile\'s owner names its kind and the set note', () => {
  const board = boardAt(0);
  board.cells[0] = { kind: 1, word: 'Eden' };
  const a = board.cells[0];
  const b = board.cells[1];
  const got = matchSwap(board, 1, 0);
  assert.ok(!got.lined);
  const line = moveLine(board, { a: b, b: a, got, turn: { lost: false } });
  assert.equal(line.kind, 'miss');
  assert.equal(line.slot, 1);
  assert.equal(line.vars.word, 'Eden');
  assert.equal(line.vars.note, NOTE);
});

test('the light nudge never contains Call\'s answer', () => {
  for (let i = 0; i < 30; i++) {
    const board = boardAt(MATCH_CALL);
    const answer = { kind: board.ask.kind, word: board.ask.word };
    board.cells[12] = answer;
    const other = board.cells[13];
    // The player moves onto the answer: the other tile speaks instead.
    let line = moveLine(board, { a: other, b: answer, got: { lined: false } });
    assert.equal(line.kind, 'miss');
    assert.ok(!words(line).includes(answer.word), words(line));
    // A note that names the answer is left out.
    board.cells[13] = { kind: 1, word: 'Eden' };
    const was = board.ask.word;
    board.ask.word = 'Rome';
    line = moveLine(board, { a: answer, b: board.cells[13], got: { lined: false } });
    assert.equal(line.vars.note, '', 'Eden\'s note names Rome');
    assert.equal(wordNote(board, 'Eden'), '');
    board.ask.word = was;
    // Every hint step names no word.
    for (let hint = 1; hint <= 3; hint++) {
      board.stuck = MATCH_BOSS.hintTurns[hint - 1];
      line = moveLine(board, { got: { lined: false, invalid: true }, turn: { lost: false }, hintWas: hint - 1 });
      assert.equal(line.kind, 'hint');
      assert.equal(line.slot, board.ask.kind, 'the answer\'s kind owner');
      assert.ok(!words(line).includes(board.ask.word));
    }
  }
});

test('Call: a line of the answer\'s kind without it is "right shelf, wrong word"', () => {
  const board = boardAt(MATCH_CALL);
  const k = board.ask.kind;
  board.cells[24] = { kind: k, word: board.ask.word };
  board.cells.splice(0, 5, T(k), T(k), T((k + 1) % 3), T(k), T((k + 2) % 3));
  const got = matchSwap(board, 2, 3);
  if (got.answered) return; // a chain fell onto the answer by luck
  assert.equal(got.wrong, 'w' + k);
  const line = moveLines(board, { got, turn: { lost: false } }).find(l => l.kind === 'wrong');
  assert.equal(line.slot, k);
});

test('Dark: swaps with no line climb a hint ladder to a real move; a line starts it again', () => {
  const board = boardAt(MATCH_DARK);
  board.cells.splice(0, 5, T(0), T(0), T(1), T(0), T(2));
  const move = matchFindMove(board);
  assert.deepEqual(move, { at: 3, to: 2, kind: 0 });
  assert.deepEqual(matchHintAt(board), move);
  assert.equal(matchHint(board), 0);
  matchSwap(board, 10, 11);
  matchSwap(board, 10, 11);
  assert.equal(board.misses, 2);
  assert.equal(matchHint(board), 1);
  assert.equal(matchHint(board, 3), 0, 'later with panic');
  const line = moveLine(board, { a: board.cells[10], b: board.cells[11], got: { lined: false }, turn: { lost: false }, hintWas: 0 });
  assert.equal(line.kind, 'hint', 'the hint beats the miss');
  assert.equal(line.slot, 0);
  board.misses = 6;
  assert.equal(matchHint(board), 3, 'the column glows');
  matchSwap(board, 2, 3);
  assert.equal(board.misses, 0);
  assert.equal(matchHint(board), 0);
  assert.equal(matchHint(boardAt(0)), 0, 'Sort has no ladder: its colours are the hint');
});

test('each phase starts with its own line, from the right crew member', () => {
  assert.deepEqual([0, 1].map(p => phaseLine(boardAt(p)).slot), [0, 2]);
  const call = boardAt(MATCH_CALL);
  assert.equal(phaseLine(call).slot, call.ask.kind);
  assert.equal(phaseLine(call, true).key, 'boss.chat.retry');
  [0, 1, 2].forEach(p => assert.notEqual(t('boss.chat.phase.' + p), 'boss.chat.phase.' + p));
  CHAT_ORDER.filter(k => !['phase', 'hint'].includes(k)).forEach(k => assert.notEqual(t('boss.chat.' + k), 'boss.chat.' + k, k));
});
