// Unit tests for minigames.js (minigames plan steps A-E): which questions a
// minigame fits, the roll (chance, no repeats, DEV -> Minigame), the
// modifiers a minigame keeps, Close Enough's dial and bands, Higher /
// Lower's bar, hints and tiers, Slow Spell's fit, spelling and tiers,
// Syllable Split's splitter, fit, tray and tiers, Letter Pool's roll,
// tray, checks, tiers and no haunts, Code Break's fit, marks and tiers,
// Verdict's fit, claims, tiers and haunts, Crosswire's fit, grid and
// tiers, Fog Reveal's fit and tiers, Sum Lock's roll, lock and haunts,
// and what a
// tier pays in the settle rules (gun.js, answers.js).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshLight } from '../js/battery.js';
import { state } from '../js/state.js';
import {
  MINIGAME_CHANCE, CLOSE_ENOUGH_REACH_MIN, CLOSE_ENOUGH_MIN_TOP, CLOSE_ENOUGH_MIN_STEPS, ENERGY_MAX, RELOAD_ENERGY,
  GATE_QUESTIONS, MINIGAME_TIER_PAY, HIGHER_LOWER_REACH_MIN, HIGHER_LOWER_MIN_TOP, HIGHER_LOWER_MIN_STEPS,
  SYLLABLE_SPLIT_DECOYS, LETTER_POOL_FORM, CODE_BREAK_TIERS, VERDICT_CLAIMS, VERDICT_BOSS_CLAIMS,
} from '../js/config.js';
import {
  MINIGAMES, MINIGAME_MODIFIERS, minigamesFor, modifiersFor, rollMinigame, forcedQuestion, endMinigame,
  closeEnoughDial, closeEnoughTier, higherLowerBar, higherLowerHint, higherLowerTier, slowSpellWord, slowSpellTier, slowSpellMatches,
  splitSyllables, syllableSplitPieces, syllableSplitTray, syllableSplitTier,
  letterPoolSetup, letterPoolCheck, letterPoolTier, codeChars, codeBreakSetup, codeBreakMarks, codeBreakTier,
  verdictSetup, verdictTier, verdictClaimCount, crosswireSetup, crosswireTier, fogRevealTier, sumLockQuestions, sumLockSetup, sumLockMatches,
} from '../js/minigames.js';
import { recordHauntAnswer } from '../js/haunts.js';
import { settleReload } from '../js/gun.js';
import { settleAnswer } from '../js/answers.js';
import { resetHaunts } from '../js/haunts.js';

const NUMBER = { term: 'How many days did it rain?', meaning: '40', answerType: 'number' };
const BIG = { term: 'How many were sealed?', meaning: '144000', answerType: 'number' };
const WORD = { term: 'Who built the ark?', meaning: 'Noah', answerType: 'name' };

// The shared state a roll or a settle reads, back to a plain start.
function reset() {
  state.settings.minigame = 'roll';
  state.settings.activeData = [NUMBER, BIG, WORD];
  state.settings.gunCombat = true;
  state.run.lastMinigame = null;
  state.run.energy = 0;
  state.run.rounds = [];
  state.run.reloadIndex = 0;
  state.run.correctTotal = 0;
  state.run.coinsTotal = 0;
  state.run.hearts = 3;
  state.run.roomIndex = 0;
  state.floor.misses = 0;
  state.floor.darkness = false;
  state.floor.light = freshLight();
  state.battle.minigame = null;
  state.battle.wager = 0;
  state.battle.currentQuestion = NUMBER;
  resetHaunts();
}

// Runs `fn` with Math.random always returning `value`.
function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
}

test('every minigame supports at least two modifiers, but Sum Lock (a box carries none)', () => {
  for (const id of MINIGAMES) {
    if (id === 'sumLock') assert.deepEqual(MINIGAME_MODIFIERS[id], []);
    else assert.ok(MINIGAME_MODIFIERS[id].length >= 2, id);
  }
});

test('Close Enough fits plain number answers only', () => {
  assert.deepEqual(minigamesFor(NUMBER), ['closeEnough', 'higherLower']);
  assert.deepEqual(minigamesFor({ meaning: '1,500%', answerType: 'number' }), ['closeEnough', 'higherLower']);
  assert.deepEqual(minigamesFor({ meaning: '4 B.C.', answerType: 'number' }), ['closeEnough', 'higherLower']);
  assert.deepEqual(minigamesFor(WORD), ['slowSpell', 'codeBreak'], 'a one-word name: no dial');
  assert.deepEqual(minigamesFor({ meaning: '7½', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ meaning: '13 and 14', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ meaning: '0', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ meaning: '1 Corinthians', answerType: 'book' }), []);
  assert.deepEqual(minigamesFor({ meaning: '443', answerType: 'port' }), ['codeBreak'], 'a port is a label, not an amount');
});

test('modifiersFor keeps every offered modifier, or gives null', () => {
  assert.deepEqual(modifiersFor('closeEnough', []), []);
  assert.deepEqual(modifiersFor('closeEnough', ['blind', 'flip']), ['blind', 'flip']);
  assert.deepEqual(modifiersFor('closeEnough', [null]), []);
  assert.equal(modifiersFor('closeEnough', ['blind', 'nothing']), null);
});

test('Higher / Lower fits whole numbers that make a short enough bar', () => {
  for (const meaning of ['1', '12', '37', '950', '12000', '600000']) {
    assert.ok(minigamesFor({ meaning, answerType: 'number' }).includes('higherLower'), meaning);
  }
  for (const meaning of ['3.5', '1453', '912', '1906', '144000', '0']) {
    assert.ok(!minigamesFor({ meaning, answerType: 'number' }).includes('higherLower'), meaning);
  }
  assert.ok(!minigamesFor(WORD).includes('higherLower'));
});

test('a fitting question runs as a minigame MINIGAME_CHANCE of the time', () => {
  reset();
  assert.equal(withRandom(MINIGAME_CHANCE - 0.01, () => rollMinigame(NUMBER, [])), 'closeEnough');
  assert.equal(state.battle.minigame, 'closeEnough');
  reset();
  assert.equal(withRandom(MINIGAME_CHANCE, () => rollMinigame(NUMBER, [])), null);
  assert.equal(state.battle.minigame, null);
  assert.equal(withRandom(0, () => rollMinigame({ ...WORD, meaning: 'John Mark' }, [])), null, 'nothing fits a two-word name');
});

test('the same minigame never runs twice in a row; a plain question clears it', () => {
  reset();
  // A question only Close Enough fits.
  const DECIMAL = { meaning: '3.5', answerType: 'number' };
  withRandom(0, () => rollMinigame(DECIMAL, []));
  assert.equal(withRandom(0, () => rollMinigame(DECIMAL, [])), null, 'not twice in a row');
  assert.equal(state.run.lastMinigame, null, 'that question was plain');
  assert.equal(withRandom(0, () => rollMinigame(DECIMAL, [])), 'closeEnough', 'so it can run again');
  assert.equal(withRandom(0, () => rollMinigame(NUMBER, [])), 'higherLower', 'another one fits after it');
});

test('an offer with a modifier the minigame lacks stays a plain question', () => {
  reset();
  assert.equal(withRandom(0, () => rollMinigame(NUMBER, ['blind', 'nothing'])), null);
});

test('DEV -> Minigame: off never rolls, a forced one always runs where it fits', () => {
  reset();
  state.settings.minigame = 'off';
  assert.equal(withRandom(0, () => rollMinigame(NUMBER, [])), null);
  state.settings.minigame = 'closeEnough';
  assert.equal(withRandom(0.99, () => rollMinigame(NUMBER, [])), 'closeEnough');
  assert.equal(withRandom(0.99, () => rollMinigame(NUMBER, [])), 'closeEnough', 'even twice in a row');
  assert.equal(rollMinigame(WORD, []), null);
  assert.ok(minigamesFor(forcedQuestion(WORD, [WORD, BIG])).includes('closeEnough'), 'a fitting question is swapped in');
  assert.ok(minigamesFor(forcedQuestion(WORD, [WORD])).includes('closeEnough'), 'or from the whole set');
  state.settings.activeData = [WORD];
  assert.equal(forcedQuestion(WORD, [WORD]), WORD, 'none to swap in');
  state.settings.minigame = 'roll';
  assert.equal(forcedQuestion(WORD, [WORD, BIG]), WORD, 'only when forced');
});

test('endMinigame scores it and clears it', () => {
  reset();
  state.battle.minigame = 'closeEnough';
  const events = endMinigame({ right: true, tier: 'X', given: '40' });
  assert.deepEqual(events, [{ type: 'minigameScored', minigame: 'closeEnough', tier: 'X', given: '40', answer: '40' }]);
  assert.equal(state.battle.minigame, null);
});

test('the dial lands on the answer, reaches past it, and has enough steps', () => {
  for (const q of [NUMBER, BIG, { meaning: '1' }, { meaning: '1453' }, { meaning: '3.5' }, { meaning: '1,500%' }]) {
    for (const r of [0, 0.5, 0.999]) {
      const dial = withRandom(r, () => closeEnoughDial(q));
      assert.ok(Math.abs(dial.answerAt * dial.step - dial.answer) < 1e-9, q.meaning + ' lands on a step');
      assert.ok(dial.top >= Math.max(CLOSE_ENOUGH_MIN_TOP, dial.answer * CLOSE_ENOUGH_REACH_MIN), q.meaning + ' reaches past it');
      assert.ok(Math.abs(dial.steps * dial.step - dial.top) < 1e-9, q.meaning + ' top is a step');
      assert.ok(dial.steps >= CLOSE_ENOUGH_MIN_STEPS || dial.step === 1, q.meaning + ' has enough steps');
    }
  }
  assert.equal(withRandom(0, () => closeEnoughDial({ meaning: '1' })).step, 1, 'a whole number gets whole steps');
  assert.equal(withRandom(0, () => closeEnoughDial({ meaning: '3.5' })).step, 0.1);
});

test('Close Enough bands: exact X, 10% = 2, 25% = 1, past that a miss', () => {
  const dial = { answer: 100, step: 1, answerAt: 100 };
  assert.equal(closeEnoughTier(dial, 100), 'X');
  assert.equal(closeEnoughTier(dial, 110), '2');
  assert.equal(closeEnoughTier(dial, 90), '2');
  assert.equal(closeEnoughTier(dial, 111), '1');
  assert.equal(closeEnoughTier(dial, 125), '1');
  assert.equal(closeEnoughTier(dial, 126), null);
});

test('Close Enough under 10: 1 off = 2, no tier 1', () => {
  const dial = { answer: 7, step: 1, answerAt: 7 };
  assert.equal(closeEnoughTier(dial, 7), 'X');
  assert.equal(closeEnoughTier(dial, 6), '2');
  assert.equal(closeEnoughTier(dial, 8), '2');
  assert.equal(closeEnoughTier(dial, 9), null);
});

test('the Higher / Lower bar lands on the answer, reaches past it, and has enough steps', () => {
  for (const meaning of ['1', '4', '12', '37', '40', '950', '12000', '600000', '1,500%']) {
    for (const r of [0, 0.5, 0.999]) {
      const bar = withRandom(r, () => higherLowerBar({ meaning, answerType: 'number' }));
      assert.equal(bar.answerAt * bar.step, bar.answer, meaning + ' lands on a step');
      assert.ok(Number.isInteger(bar.answerAt) && Number.isInteger(bar.steps), meaning + ' whole steps');
      assert.ok(bar.top >= Math.max(HIGHER_LOWER_MIN_TOP, bar.answer * HIGHER_LOWER_REACH_MIN), meaning + ' reaches past it');
      assert.equal(bar.steps * bar.step, bar.top, meaning + ' top is a step');
      assert.ok(bar.steps >= HIGHER_LOWER_MIN_STEPS && bar.steps <= 100, meaning + ' has ' + bar.steps + ' steps');
    }
  }
  assert.equal(withRandom(0, () => higherLowerBar({ meaning: '40' })).step, 5, '0-50 in fives');
});

test('Higher / Lower hints and tiers: guess 1 = X, 2 = 2, 3 = 1, then a miss', () => {
  const bar = { answer: 40, step: 5, answerAt: 8 };
  assert.equal(higherLowerHint(bar, 8), 'hit');
  assert.equal(higherLowerHint(bar, 3), 'higher');
  assert.equal(higherLowerHint(bar, 9), 'lower');
  assert.deepEqual([1, 2, 3, 4].map(higherLowerTier), ['X', '2', '1', null]);
});

// Names for Slow Spell.
const NAMES = ['Noah', 'Adam', 'adam', 'Ruth', 'Saul', 'Moses', 'Eve']
  .map(meaning => ({ term: 'Who?', meaning, answerType: 'name' }));
const BOOK = { term: 'Which book?', meaning: 'Ruth', answerType: 'book' };

test('Slow Spell fits one-word answers of 4 to 12 letters, no decoys needed (typed)', () => {
  reset();
  state.settings.activeData = [NAMES[0]];
  assert.deepEqual(minigamesFor(NAMES[0]), ['slowSpell', 'codeBreak'], 'alone in the set: typed, so nothing to pick from');
  state.settings.activeData = [...NAMES, BOOK];
  assert.ok(!minigamesFor(NAMES[6]).includes('slowSpell'), 'Eve: too short');
  assert.ok(!minigamesFor({ term: 'Who?', meaning: 'John Mark', answerType: 'name' }).includes('slowSpell'), 'two words');
  assert.ok(!minigamesFor(NUMBER).includes('slowSpell'), 'a number is no word');
  assert.ok(!minigamesFor({ ...NAMES[0], term: 'Spell Noah.' }).includes('slowSpell'), 'the stem gives it away');
  assert.ok(!MINIGAME_MODIFIERS.slowSpell.includes('timer'), 'no Timer: waiting is the game');
});

test('the Slow Spell word fills every letter but one, and takes a typed answer', () => {
  reset();
  state.settings.activeData = [...NAMES, BOOK];
  const word = slowSpellWord(NAMES[0]);
  assert.deepEqual(word.chars, ['N', 'o', 'a', 'h']);
  assert.deepEqual([...word.order].sort(), [0, 1, 2, 3]);
  assert.equal(word.total, 4);
  assert.equal(word.stopAt, 3);
  assert.ok(slowSpellMatches(word, 'noah'), 'capitals don\'t count');
  assert.ok(slowSpellMatches(word, '  Noah '), 'nor extra spaces');
  assert.ok(!slowSpellMatches(word, 'Noa'));
  assert.ok(!slowSpellMatches(word, 'Adam'));
  const dashed = slowSpellWord({ term: 'Who?', meaning: 'Abed-nego', answerType: 'name' });
  assert.equal(dashed.total, 8, 'the hyphen is no letter');
  assert.ok(!dashed.order.includes(4), 'and shows from the start');
});

test('Slow Spell tiers: 0-1 letters = X, up to half = 2, more = 1', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(n => slowSpellTier(n, 8)), ['X', 'X', '2', '2', '2', '1']);
  assert.deepEqual([1, 2, 3].map(n => slowSpellTier(n, 4)), ['X', '2', '1']);
});

// Long names for Syllable Split, and a short one whose pieces are decoys.
const LONG = ['Solomon', 'Benjamin', 'Jonathan', 'Abraham', 'Noah']
  .map(meaning => ({ term: 'Who?', meaning, answerType: 'name' }));

test('names split on their vowels, keeping digraphs and starting pairs', () => {
  const split = w => splitSyllables(w).join('-');
  assert.equal(split('Nebuchadnezzar'), 'Ne-bu-chad-nez-zar');
  assert.equal(split('Mephibosheth'), 'Me-phi-bo-sheth');
  assert.equal(split('Ishbosheth'), 'Ish-bo-sheth');
  assert.equal(split('Abraham'), 'A-bra-ham');
  assert.equal(split('Constantine'), 'Con-stan-tine', 'a silent e stays on');
  assert.equal(split('Eve'), 'Eve');
});

test('Syllable Split fits one-word names of 3+ pieces with enough decoys', () => {
  reset();
  state.settings.activeData = LONG;
  assert.deepEqual(minigamesFor(LONG[0]), ['slowSpell', 'syllableSplit', 'codeBreak', 'verdict', 'crosswire']);
  assert.equal(syllableSplitPieces(LONG[4]), null, 'Noah: two pieces');
  assert.equal(syllableSplitPieces({ ...LONG[0], answerType: 'book' }), null, 'names only');
  assert.equal(syllableSplitPieces({ ...LONG[0], meaning: 'King Solomon' }), null, 'one word');
  assert.deepEqual(minigamesFor({ ...LONG[0], term: 'Spell Solomon.' }), [], 'the stem gives it away');
  state.settings.activeData = [...LONG.slice(0, 2), LONG[4]];
  assert.ok(!minigamesFor(LONG[0]).includes('syllableSplit'), 'Benjamin gives 3 decoys; Noah, one piece, none');
});

test('a question\'s own syllables field fixes a bad split, if it spells the answer', () => {
  const q = { term: 'Who?', meaning: 'Talebearer', answerType: 'name' };
  assert.deepEqual(syllableSplitPieces(q), ['Ta', 'le', 'bea', 'rer']);
  assert.deepEqual(syllableSplitPieces({ ...q, syllables: 'Tale-bear-er' }), ['Tale', 'bear', 'er']);
  assert.deepEqual(syllableSplitPieces({ ...q, syllables: ['Tale', 'bear', 'er'] }), ['Tale', 'bear', 'er']);
  assert.deepEqual(syllableSplitPieces({ ...q, syllables: 'Tale-bear' }), ['Ta', 'le', 'bea', 'rer'], 'not the answer: ignored');
});

test('the tray holds the name\'s pieces and decoys from other names', () => {
  reset();
  state.settings.activeData = LONG;
  const { pieces, tray } = syllableSplitTray(LONG[0]);
  assert.deepEqual(pieces, ['So', 'lo', 'mon']);
  assert.equal(tray.length, pieces.length + SYLLABLE_SPLIT_DECOYS);
  for (const p of pieces) assert.ok(tray.includes(p));
  const decoys = tray.filter(p => !pieces.includes(p));
  assert.ok(decoys.every(p => !['so', 'lo', 'mon'].includes(p.toLowerCase())), 'no decoy matches a piece');
});

test('Syllable Split tiers: clean = 2, one wrong piece = 1, two = a miss', () => {
  assert.deepEqual([0, 1, 2].map(syllableSplitTier), ['2', '1', null]);
});

// A category of books for Letter Pool: five short one-word answers, and
// two it never counts (two words, too long).
const BOOKS = {
  label: 'Books',
  pool: ['Acts', 'Ruth', 'Mark', 'Job', 'Amos', 'Song of Solomon', 'Deuteronomy']
    .map(meaning => ({ term: 'Which book?', meaning, answerType: 'book' })),
};

test('Letter Pool rolls only on a category the player picked, with a label and enough answers', () => {
  reset();
  // A word question nothing else fits.
  const q = BOOKS.pool[5];
  assert.equal(withRandom(0, () => rollMinigame(q, [], BOOKS)), 'letterPool');
  assert.equal(withRandom(0, () => rollMinigame(q, [], BOOKS)), null, 'not twice in a row');
  assert.equal(withRandom(0, () => rollMinigame(q, [], null)), null, 'no category');
  assert.equal(withRandom(0, () => rollMinigame(q, [], { ...BOOKS, label: null })), null, 'no label');
  assert.equal(withRandom(0, () => rollMinigame(q, [], { ...BOOKS, pool: BOOKS.pool.slice(0, 3) })), null, 'too few answers');
  state.settings.minigame = 'letterPool';
  assert.equal(withRandom(0.99, () => rollMinigame(q, [], BOOKS)), 'letterPool', 'DEV forces it');
});

test('the Letter Pool tray holds the hidden answers\' letters, each once', () => {
  reset();
  const pool = letterPoolSetup(BOOKS);
  assert.equal(pool.label, 'Books');
  assert.equal(pool.hidden.length, LETTER_POOL_FORM + 1);
  assert.equal(new Set(pool.tiles).size, pool.tiles.length, 'each letter once');
  for (const w of pool.hidden) assert.ok([...w].every(c => pool.tiles.includes(c)), w);
  for (const w of pool.words) assert.ok([...w].every(c => pool.tiles.includes(c)), 'every word is spellable: ' + w);
  assert.ok(pool.hidden.every(w => pool.words.includes(w)));
  assert.ok(!pool.words.includes('DEUTERONOMY') && !pool.words.includes('SONG OF SOLOMON'), 'too long, two words');
});

test('Letter Pool checks a word against the hidden ones and the category', () => {
  const pool = { hidden: ['ACTS', 'RUTH'], words: ['ACTS', 'RUTH', 'CAT'], tiles: [] };
  assert.equal(letterPoolCheck(pool, 'acts'), 'hidden');
  assert.equal(letterPoolCheck(pool, 'CAT'), 'valid');
  assert.equal(letterPoolCheck(pool, 'CHART'), 'unknown');
});

test('Letter Pool tiers: every hidden one = X, the count = 2, LETTER_POOL_WEAK = 1', () => {
  const pool = { hidden: ['A', 'B', 'C', 'D'] };
  assert.equal(letterPoolTier(pool, 4, 4), 'X');
  assert.equal(letterPoolTier(pool, 5, 3), '2');
  assert.equal(letterPoolTier(pool, 3, 0), '2');
  assert.equal(letterPoolTier(pool, 2, 2), '1');
  assert.equal(letterPoolTier(pool, 1, 1), null);
});

test('a missed Letter Pool is no haunt', () => {
  reset();
  const q = { term: 'BOOKS: FORM 3.', meaning: 'Acts, Ruth', letterPool: { hidden: [] } };
  assert.equal(recordHauntAnswer(q, false), null);
  assert.equal(state.run.haunts.size, 0);
  state.battle.currentQuestion = q;
  const events = settleReload(false, { modifiers: [], energy: RELOAD_ENERGY[0] });
  assert.deepEqual(events.map(e => e.type), ['jammed', 'noiseMade']);
  assert.equal(events[0].expected, 'Acts, Ruth');
});

test('a reload pays one less energy at tier 1 (at least 1) and one more at X, but two modifiers always fill it', () => {
  const offer = (n) => ({ modifiers: [], energy: RELOAD_ENERGY[n] });
  reset();
  settleReload(true, offer(1), null, '1');
  assert.equal(state.run.energy, RELOAD_ENERGY[1] + MINIGAME_TIER_PAY[1].energy);
  reset();
  settleReload(true, offer(0), null, '1');
  assert.equal(state.run.energy, 1, 'never below 1');
  reset();
  settleReload(true, offer(1), null, 'X');
  assert.equal(state.run.energy, RELOAD_ENERGY[1] + MINIGAME_TIER_PAY.X.energy);
  reset();
  state.run.energy = ENERGY_MAX - 1;
  state.run.rounds = Array(ENERGY_MAX - 1).fill(null);
  settleReload(true, offer(2), null, 'X');
  assert.equal(state.run.energy, ENERGY_MAX, 'never past ENERGY_MAX');
  reset();
  settleReload(true, offer(1));
  assert.equal(state.run.energy, RELOAD_ENERGY[1], 'a plain question is tier 2');
  reset();
  state.run.energy = 0;
  state.run.rounds = [];
  settleReload(true, offer(2), null, '1');
  assert.equal(state.run.energy, ENERGY_MAX, 'two modifiers fill it even at tier 1');
});

test('X takes two HP off the boss; a plain answer one', () => {
  reset();
  // More HP than the gate's most, so neither answer clears it.
  const hp = GATE_QUESTIONS[0] + 2;
  state.floor.boss = { row: 1, col: 1, hp, max: hp, kind: 'boss' };
  state.battle.selectedTarget = state.floor.boss;
  const events = settleAnswer(true, false, '40', 'X');
  assert.equal(state.floor.boss.hp, hp - MINIGAME_TIER_PAY.X.bossDamage);
  assert.ok(events.some(e => e.type === 'bossHit'));
  settleAnswer(true, false, '40');
  assert.equal(state.floor.boss.hp, hp - MINIGAME_TIER_PAY.X.bossDamage - 1);
});

test('X doubles a chest\'s gold', () => {
  reset();
  state.floor.chest = { row: 1, col: 1, kind: 'chest' };
  state.battle.selectedTarget = state.floor.chest;
  settleAnswer(true, false, '40');
  const plain = state.run.coinsTotal;
  reset();
  state.floor.chest = { row: 1, col: 1, kind: 'chest' };
  state.battle.selectedTarget = state.floor.chest;
  settleAnswer(true, false, '40', 'X');
  assert.equal(state.run.coinsTotal, plain * MINIGAME_TIER_PAY.X.goldScale);
});

test('Code Break fits one-word answers of 2-9 letters or digits, not number answers', () => {
  const fits = q => minigamesFor({ term: 'Which one?', ...q }).includes('codeBreak');
  assert.ok(fits({ meaning: 'MX', answerType: 'record' }));
  assert.ok(fits({ meaning: '3389', answerType: 'port' }));
  assert.ok(fits({ meaning: 'Wi-Fi', answerType: 'networkType' }), 'a hyphen is dropped');
  assert.ok(fits({ meaning: 'Barnabas', answerType: 'name' }));
  assert.ok(!fits({ meaning: 'A', answerType: 'record' }), 'too short');
  assert.ok(!fits({ meaning: 'Mephibosheth', answerType: 'name' }), 'too long');
  assert.ok(!fits({ meaning: 'Patch panel', answerType: 'device' }), 'two words');
  assert.ok(!fits({ meaning: '40', answerType: 'number' }), 'the dials take numbers');
  assert.ok(!minigamesFor({ term: 'Spell Noah.', meaning: 'Noah', answerType: 'name' }).includes('codeBreak'), 'not when the question holds it');
});

test('a Code Break code is the answer in capitals; a port gets the number pad', () => {
  assert.deepEqual(codeBreakSetup({ meaning: 'Wi-Fi' }).code, ['W', 'I', 'F', 'I']);
  assert.equal(codeBreakSetup({ meaning: 'Wi-Fi' }).digits, false);
  assert.equal(codeBreakSetup({ meaning: '443', answerType: 'port' }).digits, true);
  assert.deepEqual(codeChars(' a-a a '), ['A', 'A', 'A']);
});

test('Code Break marks right places first, and each character only as often as the code has it', () => {
  const code = codeBreakSetup({ meaning: '443', answerType: 'port' });
  assert.deepEqual(codeBreakMarks(code, '443'), ['hit', 'hit', 'hit']);
  assert.deepEqual(codeBreakMarks(code, '143'), ['miss', 'hit', 'hit']);
  assert.deepEqual(codeBreakMarks(code, '344'), ['near', 'hit', 'near']);
  assert.deepEqual(codeBreakMarks(code, '444'), ['hit', 'hit', 'miss'], 'only two 4s to find');
  assert.deepEqual(codeBreakMarks(codeBreakSetup({ meaning: 'AXAY' }), 'aaaa'), ['hit', 'miss', 'hit', 'miss']);
  assert.deepEqual(codeBreakMarks(codeBreakSetup({ meaning: 'Noah' }), 'hano'), ['near', 'near', 'near', 'near']);
  assert.equal(codeBreakMarks(code, '44'), null, 'the wrong length is not a guess');
});

test('Code Break tiers: guess 1 = X, 2 = 2, 3 = 1, then out of guesses', () => {
  assert.equal(CODE_BREAK_TIERS.length, 3);
  assert.equal(codeBreakTier(1), 'X');
  assert.equal(codeBreakTier(2), '2');
  assert.equal(codeBreakTier(3), '1');
  assert.equal(codeBreakTier(4), null);
});

// A small set for Verdict: five names, two books, one number.
const VERDICT_SET = [
  { term: 'Who built the ark?', meaning: 'Noah', answerType: 'name' },
  { term: 'Who led Israel out of Egypt?', meaning: 'Moses', answerType: 'name' },
  { term: 'Who killed Goliath?', meaning: 'David', answerType: 'name' },
  { term: 'Who was swallowed by a fish?', meaning: 'Jonah', answerType: 'name' },
  { term: 'Who was the first man?', meaning: 'Adam', answerType: 'name' },
  { term: 'Which book comes first?', meaning: 'Genesis', answerType: 'book' },
  { term: 'Which book comes last?', meaning: 'Revelation', answerType: 'book' },
  { term: 'How many days did it rain?', meaning: '40', answerType: 'number' },
];

test('Verdict fits a question with enough other answers of its type, and enough claims in the set', () => {
  reset();
  state.settings.activeData = VERDICT_SET;
  assert.ok(minigamesFor(VERDICT_SET[0]).includes('verdict'), 'four other names');
  assert.ok(!minigamesFor(VERDICT_SET[5]).includes('verdict'), 'one other book');
  assert.ok(!minigamesFor({ ...VERDICT_SET[0], term: 'Did Noah build the ark?' }).includes('verdict'), 'the stem holds the answer');
  assert.ok(!minigamesFor({ ...VERDICT_SET[0], image: 'ark.svg' }).includes('verdict'), 'claims show words only');
  state.settings.activeData = VERDICT_SET.slice(0, 4);
  assert.ok(!minigamesFor(VERDICT_SET[0]).includes('verdict'), 'too few names for a decoy each');
});

test('Verdict claims hold the question asked, and a false one shows another answer of its type', () => {
  reset();
  state.settings.activeData = VERDICT_SET;
  const q = VERDICT_SET[1];
  const claims = withRandom(0, () => verdictSetup(q, 3));
  assert.equal(claims.length, 3);
  assert.ok(claims.some(c => c.q === q), 'the question showing is one of them');
  for (const c of claims) {
    assert.equal(c.truth, false);
    assert.notEqual(c.shown, c.q.meaning);
    assert.ok(VERDICT_SET.some(o => o.meaning === c.shown && o.answerType === c.q.answerType), 'same type');
  }
  const honest = withRandom(0.99, () => verdictSetup(q, 3));
  assert.ok(honest.every(c => c.truth && c.shown === c.q.meaning));
});

test('Verdict asks 5 claims against the boss only, 3 anywhere else', () => {
  reset();
  state.battle.selectedTarget = null;
  assert.equal(verdictClaimCount(), VERDICT_CLAIMS);
  state.battle.selectedTarget = { kind: 'minion' };
  assert.equal(verdictClaimCount(), VERDICT_CLAIMS);
  state.battle.selectedTarget = { kind: 'boss' };
  assert.equal(verdictClaimCount(), VERDICT_BOSS_CLAIMS);
  state.battle.selectedTarget = null;
});

test('Verdict tiers: 3 claims pay X or 1; the boss\'s 5 pay X, 2 or 1', () => {
  assert.equal(verdictTier(0, 3), 'X');
  assert.equal(verdictTier(1, 3), '1', 'a coin flip gets 2 of 3 half the time');
  assert.equal(verdictTier(2, 3), null);
  assert.equal(verdictTier(0, 5), 'X');
  assert.equal(verdictTier(1, 5), '2');
  assert.equal(verdictTier(2, 5), '1');
  assert.equal(verdictTier(3, 5), null);
});

test('claims called wrong become haunts; the question showing is left to the settle rule', () => {
  reset();
  state.settings.activeData = VERDICT_SET;
  state.battle.minigame = 'verdict';
  state.battle.currentQuestion = VERDICT_SET[0];
  endMinigame({ right: true, tier: '1', given: '2 of 3 right', missed: [VERDICT_SET[0], VERDICT_SET[2]] });
  assert.ok(state.run.haunts.has(VERDICT_SET[2]), 'another claim called wrong');
  assert.ok(!state.run.haunts.has(VERDICT_SET[0]), 'the settle rule records this one');
  assert.equal(state.battle.minigame, null);
});

test('Crosswire fits a one-word answer of 4-8 letters that crosses another, past both first letters', () => {
  reset();
  state.settings.activeData = VERDICT_SET;
  const fits = q => minigamesFor(q).includes('crosswire');
  assert.ok(fits(VERDICT_SET[1]), 'Moses crosses Jonah on its O');
  assert.ok(!fits(VERDICT_SET[7]), '40 is no word');
  assert.ok(!fits({ term: 'Who?', meaning: 'Eve', answerType: 'name' }), 'too short');
  assert.ok(!fits({ term: 'Who?', meaning: 'Methuselah', answerType: 'name' }), 'too long');
  assert.ok(!fits({ term: 'Who?', meaning: 'John Mark', answerType: 'name' }), 'two words');
  assert.ok(!fits({ term: 'Did Moses lead them?', meaning: 'Moses', answerType: 'name' }), 'the question holds it');
  assert.ok(!fits({ ...VERDICT_SET[1], image: 'images/moses.svg' }), 'a clue shows no picture');
  state.settings.activeData = [VERDICT_SET[0], { term: 'Who?', meaning: 'Noah', answerType: 'name' }];
  assert.ok(!fits(VERDICT_SET[0]), 'the same answer twice is no crossing');
  state.settings.activeData = [{ term: 'Who?', meaning: 'Abel', answerType: 'name' }, { term: 'Who?', meaning: 'Amos', answerType: 'name' }];
  assert.ok(!fits(state.settings.activeData[0]), 'they share only a first letter');
  assert.ok(!MINIGAME_MODIFIERS.crosswire.includes('flip'), 'no Flip');
});

test('the Crosswire grid crosses on a letter both words hold, never a first letter', () => {
  reset();
  state.settings.activeData = VERDICT_SET;
  for (let n = 0; n < 20; n++) {
    const { across, down, at } = crosswireSetup(VERDICT_SET[1]);
    assert.equal(across.q, VERDICT_SET[1]);
    assert.notEqual(down.q, VERDICT_SET[1]);
    assert.deepEqual(across.word, ['M', 'O', 'S', 'E', 'S']);
    assert.ok(at.across > 0 && at.down > 0);
    assert.equal(across.word[at.across], down.word[at.down]);
  }
});

test('Crosswire tiers: both words with 0 / 1 / 2+ reveals = X / 2 / 1, one word = 1, none = a miss', () => {
  assert.equal(crosswireTier(true, true, 0), 'X');
  assert.equal(crosswireTier(true, true, 1), '2');
  assert.equal(crosswireTier(true, true, 2), '1');
  assert.equal(crosswireTier(true, true, 5), '1');
  assert.equal(crosswireTier(true, false, 0), '1');
  assert.equal(crosswireTier(false, true, 0), '1');
  assert.equal(crosswireTier(false, false, 0), null);
});

test('Fog Reveal fits picture questions only, and takes no Timer or Blind', () => {
  reset();
  const PICTURE = { term: 'Which tool is shown?', meaning: 'Crimper', answerType: 'tool', image: 'images/crimper.svg' };
  assert.ok(minigamesFor(PICTURE).includes('fogReveal'));
  assert.ok(!minigamesFor({ ...PICTURE, image: undefined }).includes('fogReveal'));
  assert.ok(!minigamesFor({ ...PICTURE, image: '  ' }).includes('fogReveal'));
  assert.deepEqual(MINIGAME_MODIFIERS.fogReveal, ['flip', 'gambler']);
});

test('Fog Reveal tiers: 12+ tiles covered = X, 6+ = 2, fewer = 1', () => {
  assert.equal(fogRevealTier(16), 'X');
  assert.equal(fogRevealTier(12), 'X');
  assert.equal(fogRevealTier(11), '2');
  assert.equal(fogRevealTier(6), '2');
  assert.equal(fogRevealTier(5), '1');
  assert.equal(fogRevealTier(0), '1');
});

// Number questions a Sum Lock can add, and one it can't.
const SUMS = [
  { term: 'How many days did it rain?', meaning: '40', answerType: 'number' },
  { term: 'How many years was the honeymoon?', meaning: '1', answerType: 'number' },
  { term: 'How many were sealed?', meaning: '144000', answerType: 'number' },
  { term: 'What TCP port does SSH use?', meaning: '22', answerType: 'port' },
  WORD,
];

test('Sum Lock adds whole answers of 1-50 only, no ports', () => {
  reset();
  state.settings.activeData = SUMS;
  assert.deepEqual(sumLockQuestions(), SUMS.slice(0, 2));
  const lock = sumLockSetup();
  assert.notEqual(lock.first, lock.second);
  assert.equal(lock.total, 41);
  assert.equal(sumLockMatches(lock, ' 41 '), true);
  assert.equal(sumLockMatches(lock, '40'), false);
  assert.equal(sumLockMatches(lock, 'forty'), null, 'no digits, no answer yet');
});

test('a trapped box that rolls a minigame runs Sum Lock; nothing else can', () => {
  reset();
  state.settings.activeData = SUMS;
  state.battle.selectedTarget = { kind: 'box', trapped: true };
  assert.equal(withRandom(0, () => rollMinigame(WORD, [])), 'sumLock');
  assert.equal(withRandom(0, () => rollMinigame(WORD, [])), 'slowSpell', 'not twice in a row');
  state.battle.selectedTarget = { kind: 'chest' };
  state.run.lastMinigame = null;
  assert.notEqual(withRandom(0, () => rollMinigame(WORD, [])), 'sumLock');
  state.battle.selectedTarget = { kind: 'box', trapped: true };
  state.settings.activeData = [SUMS[0], WORD];
  assert.notEqual(withRandom(0, () => rollMinigame(WORD, [])), 'sumLock', 'one number is not enough');
  state.battle.selectedTarget = null;
});

test('a wrong total brings both questions back as haunts, never the lock itself', () => {
  reset();
  state.settings.activeData = SUMS;
  const lock = sumLockSetup();
  const standIn = { term: 'LOCKED.', meaning: '41 (40 + 1)', sumLock: lock };
  assert.equal(recordHauntAnswer(standIn, false), null);
  state.battle.minigame = 'sumLock';
  state.battle.currentQuestion = standIn;
  endMinigame({ right: false, tier: null, given: '40', missed: [lock.first, lock.second] });
  assert.ok(state.run.haunts.has(lock.first) && state.run.haunts.has(lock.second));
  assert.ok(!state.run.haunts.has(standIn));
});
