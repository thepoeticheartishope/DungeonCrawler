// Unit tests for minigames.js (minigames plan steps A-E): which questions a
// minigame fits, the roll (chance, no repeats, DEV -> Minigame), the
// modifiers a minigame keeps, Close Enough's dial and bands, Higher /
// Lower's bar, hints and tiers, Slow Spell's fit, spelling and tiers,
// Syllable Split's splitter, fit, tray and tiers, Letter Pool's roll,
// tray, checks, tiers and no haunts, Code Break's fit, marks and tiers,
// Verdict's fit, claims, tiers and haunts, Crosswire's fit, grid and
// tiers, Fog Reveal's fit and tiers, Sum Lock's roll, lock and haunts,
// and Patch Bay's boards, nudges, checks, fit and levels.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';

import assert from 'node:assert/strict';

import { withRandom } from './helpers.mjs';


import { state } from '../js/state.js';

import {
  MINIGAME_CHANCE, CLOSE_ENOUGH_REACH_MIN, CLOSE_ENOUGH_MIN_TOP, CLOSE_ENOUGH_MIN_STEPS,
  HIGHER_LOWER_REACH_MIN, HIGHER_LOWER_MIN_TOP, HIGHER_LOWER_MIN_STEPS,
  SYLLABLE_SPLIT_DECOYS, LETTER_POOL_FORM, CODE_BREAK_TIERS, VERDICT_CLAIMS, VERDICT_BOSS_CLAIMS, MINIGAME_LEVELS, PATCH_BAY,
} from '../js/config.js';

import { t } from '../js/text.js';

import {
  MINIGAMES, MINIGAME_MODIFIERS, SHIP_ONLY, fuelMixSetup, fuelMixPour, fuelMixTier, fuelMixDry, minigamesFor, modifiersFor, rollMinigame, forcedQuestion, endMinigame,
  closeEnoughDial, closeEnoughTier, higherLowerBar, higherLowerHint, higherLowerTier, slowSpellWord, slowSpellTier, slowSpellMatches,
  splitSyllables, syllableSplitPieces, syllableSplitTray, syllableSplitTier,
  letterPoolSetup, letterPoolCheck, letterPoolTier, codeChars, codeBreakSetup, codeBreakMarks, codeBreakTier,
  verdictSetup, verdictTier, verdictClaimCount, crosswireSetup, crosswireTier, fogRevealTier, sumLockQuestions, sumLockSetup, sumLockMatches,
} from '../js/minigames.js';




const NUMBER = { question: 'How many days did it rain?', answer: '40', answerType: 'number' };
const BIG = { question: 'How many were sealed?', answer: '144000', answerType: 'number' };
const WORD = { question: 'Who built the ark?', answer: 'Noah', answerType: 'name' };

// The shared state a roll or a settle reads, back to a plain start.
function reset() {
  state.settings.minigame = 'roll';
  state.settings.activeData = [NUMBER, BIG, WORD];
  state.settings.activeFacts = [];
  state.settings.activeTriples = { facts: [], labels: {} };
  state.run.lastMinigame = null;
  state.run.energy = 0;
  state.run.reloadIndex = 0;
  state.run.correctTotal = 0;
  state.run.coinsTotal = 0;
  state.run.hearts = 3;
  state.run.roomIndex = 0;
  state.battle.minigame = null;
  state.battle.wager = 0;
  state.battle.currentQuestion = NUMBER;
}

test('every minigame supports at least two modifiers, but Sum Lock (a box carries none) and the ship-only ones', () => {
  for (const id of MINIGAMES) {
    if (id === 'sumLock' || SHIP_ONLY.includes(id)) assert.deepEqual(MINIGAME_MODIFIERS[id], []);
    else assert.ok(MINIGAME_MODIFIERS[id].length >= 2, id);
  }
});

test('Close Enough fits plain number answers only', () => {
  assert.deepEqual(minigamesFor(NUMBER), ['closeEnough', 'higherLower', 'fuelMix']);
  assert.deepEqual(minigamesFor({ answer: '1,500%', answerType: 'number' }), ['closeEnough', 'higherLower', 'fuelMix']);
  assert.deepEqual(minigamesFor({ answer: '4 B.C.', answerType: 'number' }), ['closeEnough', 'higherLower', 'fuelMix']);
  assert.deepEqual(minigamesFor(WORD), ['slowSpell', 'codeBreak', 'starChart', 'hullPatch'], 'a one-word name: no dial');
  assert.deepEqual(minigamesFor({ answer: '7½', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ answer: '13 and 14', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ answer: '0', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ answer: '1 Corinthians', answerType: 'book' }), []);
  assert.deepEqual(minigamesFor({ answer: '443', answerType: 'port' }), ['codeBreak'], 'a port is a label, not an amount');
});

test('modifiersFor keeps every offered modifier, or gives null', () => {
  assert.deepEqual(modifiersFor('closeEnough', []), []);
  assert.deepEqual(modifiersFor('closeEnough', ['blind', 'flip']), ['blind', 'flip']);
  assert.deepEqual(modifiersFor('closeEnough', [null]), []);
  assert.equal(modifiersFor('closeEnough', ['blind', 'nothing']), null);
});

test('Higher / Lower fits whole numbers that make a short enough bar', () => {
  for (const answer of ['1', '12', '37', '950', '12000', '600000']) {
    assert.ok(minigamesFor({ answer, answerType: 'number' }).includes('higherLower'), answer);
  }
  for (const answer of ['3.5', '1453', '912', '1906', '144000', '0']) {
    assert.ok(!minigamesFor({ answer, answerType: 'number' }).includes('higherLower'), answer);
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
  assert.equal(withRandom(0, () => rollMinigame({ ...WORD, answer: 'John Mark' }, [])), null, 'nothing fits a two-word name');
});

test('the same minigame never runs twice in a row; a plain question clears it', () => {
  reset();
  // A question only Close Enough fits.
  const DECIMAL = { answer: '3.5', answerType: 'number' };
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
  for (const q of [NUMBER, BIG, { answer: '1' }, { answer: '1453' }, { answer: '3.5' }, { answer: '1,500%' }]) {
    for (const r of [0, 0.5, 0.999]) {
      const dial = withRandom(r, () => closeEnoughDial(q));
      assert.ok(Math.abs(dial.answerAt * dial.step - dial.answer) < 1e-9, q.answer + ' lands on a step');
      assert.ok(dial.top >= Math.max(CLOSE_ENOUGH_MIN_TOP, dial.answer * CLOSE_ENOUGH_REACH_MIN), q.answer + ' reaches past it');
      assert.ok(Math.abs(dial.steps * dial.step - dial.top) < 1e-9, q.answer + ' top is a step');
      assert.ok(dial.steps >= CLOSE_ENOUGH_MIN_STEPS || dial.step === 1, q.answer + ' has enough steps');
    }
  }
  assert.equal(withRandom(0, () => closeEnoughDial({ answer: '1' })).step, 1, 'a whole number gets whole steps');
  assert.equal(withRandom(0, () => closeEnoughDial({ answer: '3.5' })).step, 0.1);
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
  for (const answer of ['1', '4', '12', '37', '40', '950', '12000', '600000', '1,500%']) {
    for (const r of [0, 0.5, 0.999]) {
      const bar = withRandom(r, () => higherLowerBar({ answer, answerType: 'number' }));
      assert.equal(bar.answerAt * bar.step, bar.answer, answer + ' lands on a step');
      assert.ok(Number.isInteger(bar.answerAt) && Number.isInteger(bar.steps), answer + ' whole steps');
      assert.ok(bar.top >= Math.max(HIGHER_LOWER_MIN_TOP, bar.answer * HIGHER_LOWER_REACH_MIN), answer + ' reaches past it');
      assert.equal(bar.steps * bar.step, bar.top, answer + ' top is a step');
      assert.ok(bar.steps >= HIGHER_LOWER_MIN_STEPS && bar.steps <= 100, answer + ' has ' + bar.steps + ' steps');
    }
  }
  assert.equal(withRandom(0, () => higherLowerBar({ answer: '40' })).step, 5, '0-50 in fives');
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
  .map(answer => ({ question: 'Who?', answer, answerType: 'name' }));
const BOOK = { question: 'Which book?', answer: 'Ruth', answerType: 'book' };

test('Slow Spell fits one-word answers of 4 to 12 letters, no decoys needed (typed)', () => {
  reset();
  state.settings.activeData = [NAMES[0]];
  assert.deepEqual(minigamesFor(NAMES[0]), ['slowSpell', 'codeBreak', 'starChart', 'hullPatch'], 'alone in the set: typed, so nothing to pick from');
  state.settings.activeData = [...NAMES, BOOK];
  assert.ok(!minigamesFor(NAMES[6]).includes('slowSpell'), 'Eve: too short');
  assert.ok(!minigamesFor({ question: 'Who?', answer: 'John Mark', answerType: 'name' }).includes('slowSpell'), 'two words');
  assert.ok(!minigamesFor(NUMBER).includes('slowSpell'), 'a number is no word');
  assert.ok(!minigamesFor({ ...NAMES[0], question: 'Spell Noah.' }).includes('slowSpell'), 'the stem gives it away');
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
  const dashed = slowSpellWord({ question: 'Who?', answer: 'Abed-nego', answerType: 'name' });
  assert.equal(dashed.total, 8, 'the hyphen is no letter');
  assert.ok(!dashed.order.includes(4), 'and shows from the start');
});

test('Slow Spell tiers: 0-1 letters = X, up to half = 2, more = 1', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(n => slowSpellTier(n, 8)), ['X', 'X', '2', '2', '2', '1']);
  assert.deepEqual([1, 2, 3].map(n => slowSpellTier(n, 4)), ['X', '2', '1']);
});

// Long names for Syllable Split, and a short one whose pieces are decoys.
const LONG = ['Solomon', 'Benjamin', 'Jonathan', 'Abraham', 'Noah']
  .map(answer => ({ question: 'Who?', answer, answerType: 'name' }));

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
  assert.deepEqual(minigamesFor(LONG[0]), ['slowSpell', 'syllableSplit', 'codeBreak', 'verdict', 'crosswire', 'starChart', 'hullPatch', 'asteroids']);
  assert.equal(syllableSplitPieces(LONG[4]), null, 'Noah: two pieces');
  assert.equal(syllableSplitPieces({ ...LONG[0], answerType: 'book' }), null, 'names only');
  assert.equal(syllableSplitPieces({ ...LONG[0], answer: 'King Solomon' }), null, 'one word');
  assert.deepEqual(minigamesFor({ ...LONG[0], question: 'Spell Solomon.' }), [], 'the stem gives it away');
  state.settings.activeData = [...LONG.slice(0, 2), LONG[4]];
  assert.ok(!minigamesFor(LONG[0]).includes('syllableSplit'), 'Benjamin gives 3 decoys; Noah, one piece, none');
});

test('a question\'s own syllables field fixes a bad split, if it spells the answer', () => {
  const q = { question: 'Who?', answer: 'Talebearer', answerType: 'name' };
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
    .map(answer => ({ question: 'Which book?', answer, answerType: 'book' })),
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

test('Code Break fits one-word answers of 2-9 letters or digits, not number answers', () => {
  const fits = q => minigamesFor({ question: 'Which one?', ...q }).includes('codeBreak');
  assert.ok(fits({ answer: 'MX', answerType: 'record' }));
  assert.ok(fits({ answer: '3389', answerType: 'port' }));
  assert.ok(fits({ answer: 'Wi-Fi', answerType: 'networkType' }), 'a hyphen is dropped');
  assert.ok(fits({ answer: 'Barnabas', answerType: 'name' }));
  assert.ok(!fits({ answer: 'A', answerType: 'record' }), 'too short');
  assert.ok(!fits({ answer: 'Mephibosheth', answerType: 'name' }), 'too long');
  assert.ok(!fits({ answer: 'Patch panel', answerType: 'device' }), 'two words');
  assert.ok(!fits({ answer: '40', answerType: 'number' }), 'the dials take numbers');
  assert.ok(!minigamesFor({ question: 'Spell Noah.', answer: 'Noah', answerType: 'name' }).includes('codeBreak'), 'not when the question holds it');
});

test('a Code Break code is the answer in capitals; a port gets the number pad', () => {
  assert.deepEqual(codeBreakSetup({ answer: 'Wi-Fi' }).code, ['W', 'I', 'F', 'I']);
  assert.equal(codeBreakSetup({ answer: 'Wi-Fi' }).digits, false);
  assert.equal(codeBreakSetup({ answer: '443', answerType: 'port' }).digits, true);
  assert.deepEqual(codeChars(' a-a a '), ['A', 'A', 'A']);
});

test('Code Break marks right places first, and each character only as often as the code has it', () => {
  const code = codeBreakSetup({ answer: '443', answerType: 'port' });
  assert.deepEqual(codeBreakMarks(code, '443'), ['hit', 'hit', 'hit']);
  assert.deepEqual(codeBreakMarks(code, '143'), ['miss', 'hit', 'hit']);
  assert.deepEqual(codeBreakMarks(code, '344'), ['near', 'hit', 'near']);
  assert.deepEqual(codeBreakMarks(code, '444'), ['hit', 'hit', 'miss'], 'only two 4s to find');
  assert.deepEqual(codeBreakMarks(codeBreakSetup({ answer: 'AXAY' }), 'aaaa'), ['hit', 'miss', 'hit', 'miss']);
  assert.deepEqual(codeBreakMarks(codeBreakSetup({ answer: 'Noah' }), 'hano'), ['near', 'near', 'near', 'near']);
  assert.equal(codeBreakMarks(code, '44'), null, 'the wrong length is not a guess');
});

test('Code Break tiers: guess 1 = X, 2-3 = 2, 4-5 = 1, then out of guesses', () => {
  assert.equal(CODE_BREAK_TIERS.length, 5);
  assert.equal(codeBreakTier(1), 'X');
  assert.equal(codeBreakTier(2), '2');
  assert.equal(codeBreakTier(3), '2');
  assert.equal(codeBreakTier(4), '1');
  assert.equal(codeBreakTier(5), '1');
  assert.equal(codeBreakTier(6), null);
});

// A small set for Verdict: five names, two books, one number.
const VERDICT_SET = [
  { question: 'Who built the ark?', answer: 'Noah', answerType: 'name' },
  { question: 'Who led Israel out of Egypt?', answer: 'Moses', answerType: 'name' },
  { question: 'Who killed Goliath?', answer: 'David', answerType: 'name' },
  { question: 'Who was swallowed by a fish?', answer: 'Jonah', answerType: 'name' },
  { question: 'Who was the first man?', answer: 'Adam', answerType: 'name' },
  { question: 'Which book comes first?', answer: 'Genesis', answerType: 'book' },
  { question: 'Which book comes last?', answer: 'Revelation', answerType: 'book' },
  { question: 'How many days did it rain?', answer: '40', answerType: 'number' },
];

test('Verdict fits a question with enough other answers of its type, and enough claims in the set', () => {
  reset();
  state.settings.activeData = VERDICT_SET;
  assert.ok(minigamesFor(VERDICT_SET[0]).includes('verdict'), 'four other names');
  assert.ok(!minigamesFor(VERDICT_SET[5]).includes('verdict'), 'one other book');
  assert.ok(!minigamesFor({ ...VERDICT_SET[0], question: 'Did Noah build the ark?' }).includes('verdict'), 'the stem holds the answer');
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
    assert.notEqual(c.shown, c.q.answer);
    assert.ok(VERDICT_SET.some(o => o.answer === c.shown && o.answerType === c.q.answerType), 'same type');
  }
  const honest = withRandom(0.99, () => verdictSetup(q, 3));
  assert.ok(honest.every(c => c.truth && c.shown === c.q.answer));
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

test('after claims are called wrong the minigame is cleared', () => {
  reset();
  state.settings.activeData = VERDICT_SET;
  state.battle.minigame = 'verdict';
  state.battle.currentQuestion = VERDICT_SET[0];
  endMinigame({ right: true, tier: '1', given: '2 of 3 right', missed: [VERDICT_SET[0], VERDICT_SET[2]] });
  assert.equal(state.battle.minigame, null);
});

test('Crosswire fits a one-word answer of 4-8 letters that crosses another, past both first letters', () => {
  reset();
  state.settings.activeData = VERDICT_SET;
  const fits = q => minigamesFor(q).includes('crosswire');
  assert.ok(fits(VERDICT_SET[1]), 'Moses crosses Jonah on its O');
  assert.ok(!fits(VERDICT_SET[7]), '40 is no word');
  assert.ok(!fits({ question: 'Who?', answer: 'Eve', answerType: 'name' }), 'too short');
  assert.ok(!fits({ question: 'Who?', answer: 'Methuselah', answerType: 'name' }), 'too long');
  assert.ok(!fits({ question: 'Who?', answer: 'John Mark', answerType: 'name' }), 'two words');
  assert.ok(!fits({ question: 'Did Moses lead them?', answer: 'Moses', answerType: 'name' }), 'the question holds it');
  assert.ok(!fits({ ...VERDICT_SET[1], image: 'images/moses.svg' }), 'a clue shows no picture');
  state.settings.activeData = [VERDICT_SET[0], { question: 'Who?', answer: 'Noah', answerType: 'name' }];
  assert.ok(!fits(VERDICT_SET[0]), 'the same answer twice is no crossing');
  state.settings.activeData = [{ question: 'Who?', answer: 'Abel', answerType: 'name' }, { question: 'Who?', answer: 'Amos', answerType: 'name' }];
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
  const PICTURE = { question: 'Which tool is shown?', answer: 'Crimper', answerType: 'tool', image: 'images/crimper.svg' };
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
  { question: 'How many days did it rain?', answer: '40', answerType: 'number' },
  { question: 'How many years was the honeymoon?', answer: '1', answerType: 'number' },
  { question: 'How many were sealed?', answer: '144000', answerType: 'number' },
  { question: 'What TCP port does SSH use?', answer: '22', answerType: 'port' },
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

// ---- Fuel Mix (ship minigames plan step A) ----

test('Fuel Mix: tanks are powers of ten up to the answer, at least three, and a 5; par is the fewest pours', () => {
  assert.deepEqual(fuelMixSetup({ answer: '13', answerType: 'number' }).tanks, [100, 10, 5, 1]);
  assert.deepEqual(fuelMixSetup({ answer: '950', answerType: 'number' }).tanks, [100, 10, 5, 1]);
  assert.deepEqual(fuelMixSetup({ answer: '1260', answerType: 'number' }).tanks, [1000, 100, 10, 5, 1]);
  assert.equal(fuelMixSetup({ answer: '950', answerType: 'number' }).par, 14);
  assert.equal(fuelMixSetup({ answer: '1,000', answerType: 'number' }).par, 1);
  assert.equal(fuelMixSetup({ answer: '7', answerType: 'number' }).par, 3, '5 + 1 + 1');
  assert.equal(fuelMixSetup({ answer: '19', answerType: 'number' }).par, 6, '10 + 5 + 1 x 4');
  assert.ok(minigamesFor(BIG).includes('fuelMix'), '144000 fits (tanks up to 100000)');
  assert.ok(!minigamesFor({ answer: '7½', answerType: 'number' }).includes('fuelMix'));
  assert.ok(!minigamesFor(WORD).includes('fuelMix'));
});

test('Fuel Mix: a pour says only under, over (vent to empty) or match', () => {
  const e = fuelMixSetup({ answer: '13', answerType: 'number' });
  assert.equal(fuelMixPour(e, 10), 'under');
  assert.equal(fuelMixPour(e, 10), 'over');
  assert.equal(e.total, 0, 'over vents the engine');
  assert.equal(e.vents, 1);
  assert.equal(fuelMixPour(e, 10), 'under');
  for (let i = 0; i < 2; i++) assert.equal(fuelMixPour(e, 1), 'under');
  assert.equal(fuelMixPour(e, 1), 'match');
});

test('Fuel Mix: tier by pours over par, vents counted; past the slack it runs dry', () => {
  const at = (pours, vents) => ({ ...fuelMixSetup({ answer: '13', answerType: 'number' }), pours, vents });
  assert.equal(fuelMixTier(at(4, 0)), 'X', 'par 4');
  assert.equal(fuelMixTier(at(6, 1)), '2', '2 over + 1 vent = 3');
  assert.equal(fuelMixTier(at(9, 0)), '1');
  assert.ok(!fuelMixDry(at(12, 0)), '8 over is still 1');
  assert.ok(fuelMixDry(at(13, 0)), '9 over runs dry');
});

test('Fuel Mix is ship-only: never rolled in place of a question', () => {
  for (const r of [0, 0.3, 0.6, 0.99]) {
    assert.notEqual(withRandom(r, () => rollMinigame(NUMBER, [])), 'fuelMix');
  }
});

// ---- Scanner (ship minigames plan step B) ----

test('Scanner: tier by share scanned, one step down per wrong option, a miss past the allowance', async () => {
  const { scannerTier, scannerGrid, SHIP_ONLY: ship } = await import('../js/minigames.js');
  assert.equal(scannerTier(4, 20, 0), 'X');
  assert.equal(scannerTier(5, 20, 0), '2');
  assert.equal(scannerTier(8, 20, 0), '2');
  assert.equal(scannerTier(9, 20, 0), '1');
  assert.equal(scannerTier(0, 20, 1), '2', 'a wrong option steps X down');
  assert.equal(scannerTier(12, 20, 1), '1', 'never below 1');
  assert.equal(scannerTier(0, 20, 2), null, 'a second wrong option is a miss');
  assert.deepEqual(scannerGrid(0), { cols: 5, rows: 4 });
  assert.ok(ship.includes('scanner'));
  assert.ok(minigamesFor({ question: 'Which tool is shown?', answer: 'Crimper', image: 'images/crimper.svg', answerType: 'term' }).includes('scanner'));
});

// ---- Star Chart (ship minigames plan step C) ----

test('Star Chart: the word\'s letters plus decoys not in it; more decoys with its level', async () => {
  const { starChartSetup } = await import('../js/minigames.js');
  const q = { question: 'What king wanted to kill baby Jesus?', answer: 'Herod', answerType: 'name' };
  const calm = starChartSetup(q);
  assert.equal(calm.word, 'HEROD');
  assert.equal(calm.stars.length, 5 + 6);
  const decoys = calm.stars.map(s => s.letter).filter(c => !'HEROD'.includes(c));
  assert.equal(decoys.length, 6, 'decoys are letters not in the word');
  state.run.ship = { panic: 0, perfect: { starChart: 2 } };
  assert.equal(starChartSetup(q).stars.length, 5 + 10);
  state.run.ship = null;
  calm.stars.forEach(s => assert.ok(s.x > 0 && s.x < 100 && s.y > 0 && s.y < 100));
  assert.ok(!minigamesFor({ answer: 'Lot\'s wife', answerType: 'related' }).includes('starChart'), 'one word of plain letters only');
  assert.ok(!minigamesFor({ question: 'Spell Noah.', answer: 'Noah', answerType: 'name' }).includes('starChart'), 'not when the stem holds it');
});

test('Star Chart: picks join in order; a wrong star goes dark; tiers by wrong stars', async () => {
  const { starChartSetup, starChartPick, starChartTier } = await import('../js/minigames.js');
  const chart = starChartSetup({ question: 'Who?', answer: 'Lot', answerType: 'name' });
  const at = c => chart.stars.findIndex(s => s.letter === c);
  const decoy = chart.stars.findIndex(s => !'LOT'.includes(s.letter));
  assert.equal(starChartPick(chart, at('O')), 'wrong', 'O is not first');
  assert.equal(starChartPick(chart, at('O')), 'used', 'a dark star does nothing');
  assert.equal(starChartPick(chart, decoy), 'wrong');
  assert.equal(starChartPick(chart, at('L')), 'next');
  assert.equal(starChartPick(chart, at('L')), 'used', 'a joined star does nothing');
  assert.equal(chart.wrong, 2);
  assert.equal(starChartTier(0), 'X');
  assert.equal(starChartTier(2), '2');
  assert.equal(starChartTier(4), '1');
  assert.equal(starChartTier(5), null);
});

// ---- Hull Patch (ship minigames plan step D) ----

test('Hull Patch: the tray holds the word\'s letters once each plus decoys', async () => {
  const { hullPatchSetup } = await import('../js/minigames.js');
  const q = { question: 'Which Caesar reigned?', answer: 'Tiberius', answerType: 'name' };
  const hull = hullPatchSetup(q);
  assert.equal(hull.word, 'TIBERIUS');
  assert.equal(hull.tray.length, 7 + 7, 'T I B E R U S once each, and 7 decoys');
  assert.equal(new Set(hull.tray).size, hull.tray.length, 'no plate twice');
  assert.equal(hull.max, 5);
});

test('Hull Patch: a right plate fills every spot, a wrong one strains; breach at the max; tiers by strain', async () => {
  const { hullPatchSetup, hullPatchPlate, hullPatchTier } = await import('../js/minigames.js');
  const hull = hullPatchSetup({ question: 'Who?', answer: 'Anna', answerType: 'name' });
  assert.equal(hullPatchPlate(hull, 'A'), 'fits', 'both As at once');
  assert.equal(hullPatchPlate(hull, 'A'), 'used');
  assert.equal(hullPatchPlate(hull, 'Z'), 'off');
  assert.equal(hull.strain, 1);
  assert.equal(hullPatchPlate(hull, 'N'), 'sealed');
  state.run.ship = { panic: 0, perfect: { hullPatch: 2 } };
  const weak = hullPatchSetup({ question: 'Who?', answer: 'Anna', answerType: 'name' });
  state.run.ship = null;
  assert.equal(hullPatchPlate(weak, 'B'), 'off');
  assert.equal(hullPatchPlate(weak, 'C'), 'off');
  assert.equal(hullPatchPlate(weak, 'D'), 'off');
  assert.equal(hullPatchPlate(weak, 'E'), 'breach', 'a level-2 hull breaches at 4');
  assert.equal(hullPatchTier(0), 'X');
  assert.equal(hullPatchTier(2), '2');
  assert.equal(hullPatchTier(4), '1');
});

// ---- Inference (ship minigames plan step E) ----

const FIVE_FACTS = [
  { fact: 'Books of the Pentateuch', value: 5 },
  { fact: 'Loaves that fed the 4,000', value: 7 },
  { fact: 'Days Moses spent on the mountain', value: 40 },
  { fact: 'Elders around the throne', value: 24 },
  { fact: 'Gates of the New Jerusalem', value: 12 },
];

test('Inference runs the set\'s facts list: whole numbers of 1 or more, with two others to help', async () => {
  const { inferenceTargets, inferenceQuestion, roleCanRun } = await import('../js/minigames.js');
  reset();
  state.settings.activeFacts = FIVE_FACTS.slice(0, 2);
  assert.equal(inferenceTargets().length, 0, 'one helper is not enough');
  assert.ok(!roleCanRun('inference'), 'the Science Officer sits out');
  state.settings.activeFacts = [...FIVE_FACTS.slice(0, 2), { fact: 'Port', value: 'encrypted web' }, { fact: 'Half', value: 2.5 }, { fact: 'None', value: 0 }];
  assert.equal(inferenceTargets().length, 0, 'text, fractions and 0 are kept but not used');
  state.settings.activeFacts = FIVE_FACTS;
  assert.equal(inferenceTargets().length, 5);
  assert.ok(roleCanRun('inference'));
  assert.ok(!minigamesFor(NUMBER).includes('inference'), 'a question of the set never runs it');
  const q = inferenceQuestion();
  assert.ok(minigamesFor(q).includes('inference'), 'its stand-in does');
  assert.equal(q.answer, String(q.inference.value));
  for (let n = 0; n < 20; n++) assert.notEqual(inferenceQuestion(q).inference.fact, q.inference.fact, 'never the same fact twice running');
  state.settings.activeFacts = [];
  assert.ok(!roleCanRun('inference'), 'no facts file: sits out');
});

const BIBLE_FACTS = [[5, 'Pentateuch'], [70, 'Babylon'], [9, 'Beatitudes'], [50, 'Jubilee'], [17, 'Joseph'], [20, 'Judah'],
  [13, 'Jericho'], [30, 'Judas'], [8, 'Ark'], [7, 'Loaves'], [90, 'Sarah'], [100, 'Abraham'], [3, 'Nineveh'], [21, 'Epistles'],
  [4, 'Soldiers'], [12, 'Gates'], [39, 'OT books'], [24, 'Elders'], [19, 'Kings'], [40, 'Moses']]
  .map(([value, fact]) => ({ fact, value }));

test('Inference: at every level each line brings in one new symbol, the truth holds, a wrong answer breaks a line', async () => {
  const { inferenceSetup, inferenceCheck, inferenceValue } = await import('../js/minigames.js');
  const { INFERENCE } = await import('../js/config.js');
  reset();
  for (const data of [FIVE_FACTS, BIBLE_FACTS]) {
    state.settings.activeFacts = data;
    INFERENCE.levels.forEach((lv, level) => {
      const used = new Set();
      for (let n = 0; n < 60; n++) {
        const target = data[n % data.length];
        const puzzle = inferenceSetup(target, level);
        const ids = Object.keys(puzzle.facts);
        assert.ok(ids.length <= lv.facts && ids.includes('T'));
        const truth = Object.fromEntries(ids.map(id => [id, puzzle.facts[id].value]));
        assert.equal(truth.T, target.value);
        assert.equal(new Set(ids.map(id => puzzle.facts[id].sign)).size, ids.length, 'a sign each');
        const order = [...ids.filter(id => id !== 'T'), 'T'];
        puzzle.lines.forEach((line, k) => {
          assert.equal(inferenceValue(line, truth), line.total);
          assert.ok(line.total >= 0 && line.total <= INFERENCE.maxTotal, JSON.stringify(line));
          // Only the line's own new fact and ones before it.
          const facts = line.terms.filter(term => truth[term] !== undefined);
          assert.ok(facts.includes(order[k]) && facts.every(f => order.indexOf(f) <= k), JSON.stringify(line));
          line.terms.filter(term => truth[term] === undefined).forEach((op) => {
            used.add(op);
            assert.ok(op === '+' || lv.ops.includes(op === '^2' ? '^' : op), 'level ' + level + ' uses ' + op);
          });
        });
        assert.ok(inferenceCheck(puzzle, truth).solved);
        const negative = Object.fromEntries(ids.map(id => [id, -truth[id]]));
        assert.ok(!inferenceCheck(puzzle, negative).solved, 'never with negatives (a square root)');
        for (const off of [-1, 1]) {
          const wrong = inferenceCheck(puzzle, { ...truth, T: truth.T + off });
          assert.ok(!wrong.solved && wrong.holds.includes(false), 'a wrong answer breaks a line');
        }
      }
      if (data === BIBLE_FACTS) lv.ops.forEach(op => assert.ok(used.has(op === '^' ? '^2' : op), 'level ' + level + ' shows ' + op));
    });
  }
});

test('Inference: x and / before + and -, squares first', async () => {
  const { inferenceValue } = await import('../js/minigames.js');
  assert.equal(inferenceValue({ terms: ['A', '+', 'B', 'x', 'C'] }, { A: 1, B: 2, C: 3 }), 7);
  assert.equal(inferenceValue({ terms: ['A', '/', 'B', '-', 'C'] }, { A: 70, B: 7, C: 3 }), 7);
  assert.equal(inferenceValue({ terms: ['A', '^2', '+', 'B'] }, { A: 4, B: 5 }), 21);
  assert.equal(inferenceValue({ terms: ['A', 'x', 'B', '^2'] }, { A: 2, B: 3 }), 18);
});

test('Inference grows with the run: every INFERENCE.solvesPerLevel perfect solves on the ship is a level up, to the last', async () => {
  const { inferenceLevel, inferenceSetup, inferenceTier } = await import('../js/minigames.js');
  const { INFERENCE } = await import('../js/config.js');
  reset();
  state.settings.activeFacts = BIBLE_FACTS;
  state.run.ship = { panic: 0, perfect: {} };
  assert.equal(inferenceLevel(), 0);
  const per = INFERENCE.solvesPerLevel;
  for (let k = 0; k < (INFERENCE.levels.length + 1) * per; k++) {
    state.run.ship.perfect.inference = k;
    assert.equal(inferenceSetup(BIBLE_FACTS[19]).level, Math.min(Math.floor(k / per), INFERENCE.levels.length - 1));
  }
  state.run.ship.panic = 3;
  state.run.ship.perfect.inference = 0;
  assert.equal(inferenceLevel(), 0, 'panic plays no part');
  state.run.ship = null;
  assert.equal(inferenceTier(1), 'X');
  assert.equal(inferenceTier(2), '2');
  assert.equal(inferenceTier(4), '1');
});

// ---- Levels: each game harder with every perfect solve ----

test('a perfect solve on the ship raises that game\'s level; anything less, or off the ship, doesn\'t', async () => {
  const { endMinigame, minigameLevel, bestTier } = await import('../js/minigames.js');
  const { MINIGAME_LEVELS } = await import('../js/config.js');
  reset();
  state.run.ship = { panic: 0, perfect: {} };
  state.battle.currentQuestion = { question: 'Who?', answer: 'Lot' };
  const play = (id, tier, right = true) => { state.battle.minigame = id; endMinigame({ right, tier, given: 'x' }); };
  play('starChart', '2');
  play('starChart', 'X', false);
  assert.equal(minigameLevel('starChart'), 0, 'only the best tier counts');
  play('starChart', 'X');
  assert.equal(minigameLevel('starChart'), 1);
  assert.equal(minigameLevel('hullPatch'), 0, 'per game');
  assert.equal(bestTier('syllableSplit'), '2', 'Syllable Split has no X');
  play('syllableSplit', '2');
  assert.equal(minigameLevel('syllableSplit'), 1);
  for (let k = 0; k < 10; k++) play('starChart', 'X');
  assert.equal(minigameLevel('starChart'), MINIGAME_LEVELS.games.starChart.length - 1, 'up to its last level');
  state.run.ship.panic = 3;
  assert.equal(minigameLevel('hullPatch'), 0, 'panic plays no part');
  state.run.ship.panic = 0;
  assert.equal(minigameLevel('match'), 0, 'the boss has no levels');
  state.run.ship = null;
  play('hullPatch', 'X');
  assert.equal(minigameLevel('hullPatch'), 0, 'off the ship: no levels');
});

test('each game\'s setup follows its level', async () => {
  const m = await import('../js/minigames.js');
  reset();
  state.run.ship = { panic: 0, perfect: {} };
  const at = (id, n) => { state.run.ship.perfect[id] = n; };
  const word = { question: 'Who?', answer: 'Tiberius', answerType: 'name' };
  at('starChart', 0); const base = m.starChartSetup(word).stars.length;
  at('starChart', 3); assert.equal(m.starChartSetup(word).stars.length, base + 6, 'more decoy stars');
  at('hullPatch', 3); const hull = m.hullPatchSetup(word);
  assert.equal(hull.max, 3); assert.equal(hull.tray.length, 7 + 11);
  at('scanner', 1); assert.deepEqual(m.scannerGrid(0), { cols: 6, rows: 5 });
  at('fuelMix', 3); const engine = m.fuelMixSetup({ answer: '13', answerType: 'number' });
  assert.ok(engine.hideTotal && engine.slack1 === 5 && engine.slack2 === 1);
  at('codeBreak', 2); const code = m.codeBreakSetup({ answer: 'Noah' });
  assert.deepEqual(code.tiers, ['X', '2', '2', '1']);
  assert.equal(m.codeBreakTier(2, code.tiers), '2');
  assert.equal(m.codeBreakTier(5, code.tiers), null, 'out of guesses sooner');
  at('asteroids', 3);
  state.settings.activeData = NAMES;
  const field = m.asteroidsSetup(NAMES[0]);
  assert.equal(field.maxShots, 2);
  assert.equal(m.asteroidsTier(2, field.maxShots), 'X');
  assert.equal(m.asteroidsTier(1, field.maxShots), '2');
  state.run.ship = null;
});

// ---- Asteroids (ship minigames plan step F) ----

test('Asteroids: the right rock and decoys of its kind, each a real answer; more rocks with its level', async () => {
  const { asteroidsSetup } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = [...NAMES, BOOK];
  const q = NAMES[0];
  const calm = asteroidsSetup(q);
  assert.equal(calm.rocks.length, 4);
  assert.equal(calm.rocks.filter(r => r.right).length, 1);
  assert.equal(calm.rocks[0].text, q.answer, 'the right rock comes first; the view mixes them');
  calm.rocks.slice(1).forEach((r) => {
    const from = NAMES.find(n => n.answer === r.text);
    assert.ok(from, 'a decoy is another answer in the set');
    assert.equal(r.asks, from.question, 'and says what it is the answer to');
  });
  state.run.ship = { panic: 0, perfect: { asteroids: 2 } };
  assert.equal(asteroidsSetup(q).rocks.length, Math.min(6, NAMES.length));
  state.run.ship = null;
  assert.ok(!minigamesFor(BOOK).includes('asteroids'), 'a kind with no decoys in the set');
});

test('Asteroids: a wrong rock spends a shot, the last is a miss; tiers by shots left; the arc fits the field', async () => {
  const { asteroidsHit, asteroidsTier, asteroidsLayout } = await import('../js/minigames.js');
  const field = { shots: 3 };
  assert.equal(asteroidsHit(field, { right: false }), 'wrong');
  assert.equal(field.shots, 2);
  assert.equal(asteroidsHit(field, { right: true }), 'right');
  assert.equal(asteroidsHit(field, { right: false }), 'wrong');
  assert.equal(asteroidsHit(field, { right: false }), 'out');
  assert.equal(asteroidsTier(3), 'X');
  assert.equal(asteroidsTier(2), '2');
  assert.equal(asteroidsTier(1), '1');
  const wide = asteroidsLayout(600, 240, 96, 6);
  const phone = asteroidsLayout(234, 240, 78, 6); // a 390 px phone's field
  const narrow = asteroidsLayout(204, 240, 78, 6); // 360 px
  const tiny = asteroidsLayout(164, 240, 78, 6); // 320 px
  assert.ok(wide.n >= phone.n && phone.n >= narrow.n, 'a narrow field flies fewer rocks');
  assert.ok(phone.n >= 3, 'a phone still gets a real choice');
  assert.equal(narrow.rockW, 78, 'fewer rocks, not smaller ones, while 2 fit');
  assert.ok(tiny && tiny.n === 2 && tiny.rockW < 78, 'only when 2 do not fit do the rocks get smaller');
  for (const lay of [wide, phone, narrow, tiny]) {
    const r = lay.rockW / 2 + 5;
    lay.rocks.forEach((rock, i) => {
      const a = rock.a * Math.PI / 180;
      // Clear above the ship's tip (18 px), never level with it or on it
      // (Timothy 2026-11-01: on a phone they sat on the ship).
      assert.ok(rock.d * Math.cos(a) - lay.rockW * 0.4 - 5 >= 18 + 10, 'rock ' + i + ' above the ship: ' + JSON.stringify(lay));
      // Neighbours' angles, with each rock's half-width and drift, never meet.
      if (i) {
        const prev = lay.rocks[i - 1];
        const half = d => Math.atan(r / d) * 180 / Math.PI;
        assert.ok(rock.a - prev.a >= half(prev.d) + half(rock.d), 'neighbours apart: ' + JSON.stringify(lay));
      }
    });
  }
});

// ---- Match, the final boss (ship minigames plan step G3) ----

const BOSS_SET = [
  ...['Ruth', 'Acts', 'Jude', 'Amos', 'Joel', 'Ezra', 'Luke'].map(m => ({ question: 'Which book?', answer: m, answerType: 'book' })),
  ...['Rome', 'Eden', 'Moab', 'Edom', 'Joppa', 'Nebo', 'Egypt'].map(m => ({ question: 'Where?', answer: m, answerType: 'location' })),
  ...['Paul', 'Herod', 'Lot', 'Aaron', 'Silas', 'Jacob', 'Saul', 'Eli'].map(m => ({ question: 'Who?', answer: m, answerType: 'name' })),
  { question: 'Long?', answer: 'Nebuchadnezzar', answerType: 'name' },
];

test('Match boss: three kinds of short answers, biggest first; a fresh board has no line and its crisis', async () => {
  const { matchGroups, matchSetup, matchRuns, matchCrisis } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = BOSS_SET;
  const groups = matchGroups();
  assert.deepEqual(groups.map(g => g.key), ['name', 'book', 'location']);
  assert.ok(!groups[0].words.includes('Nebuchadnezzar'), 'too long for a tile');
  const board = matchSetup(groups);
  assert.equal(board.cells.length, 25);
  assert.equal(matchRuns(board).length, 0);
  assert.equal(matchCrisis(board), 2);
  state.settings.activeData = BOSS_SET.slice(0, 7);
  assert.equal(matchGroups(), null, 'one kind is not a board');
});

test('Match boss: a swap with no line snaps back; a line clears, charges, and new tiles never line up alone', async () => {
  const { matchGroups, matchSetup, matchSwap, matchRuns } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = BOSS_SET;
  const board = matchSetup(matchGroups());
  const kinds = (k0) => board.cells.map(t => t.kind);
  // A row set up to line up by swapping tiles 3 and 4: 0 0 1 0 1 -> swap 2 and 3.
  const T = k => ({ kind: k, word: 'w' + k });
  // No line anywhere: row r, column c holds kind (c + 2r) % 3.
  board.cells = Array.from({ length: 25 }, (_, i) => T(((i % 5) + 2 * Math.floor(i / 5)) % 3));
  board.cells.splice(0, 5, T(0), T(0), T(1), T(0), T(2));
  board.cells[7] = { kind: 'crisis', word: '!!' };
  const before = kinds();
  const no = matchSwap(board, 10, 11);
  if (!no.lined) assert.deepEqual(kinds(), before, 'snapped back');
  const yes = matchSwap(board, 2, 3);
  assert.ok(yes.lined);
  assert.ok(yes.waves[0].hit.includes(7), 'the crisis next to the line clears');
  assert.ok(board.charge[0] >= 1, 'the kind-0 crew member is charged');
  assert.equal(matchRuns(board).length, 0, 'it settles with no line left');
  assert.ok(!matchSwap(board, 0, 12).lined, 'not neighbours');
});

test('Match boss: the crisis spreads every 2nd turn (unless held back); abilities spend charge; full charge wins', async () => {
  const { matchGroups, matchSetup, matchEndTurn, matchUse, matchWon, matchCrisis } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = BOSS_SET;
  const board = matchSetup(matchGroups());
  assert.equal(matchEndTurn(board).spread, null);
  assert.notEqual(matchEndTurn(board).spread, null, 'spreads on the 2nd turn');
  assert.equal(matchCrisis(board), 3);
  board.charge = [5, 5, 5];
  assert.ok(matchWon(board));
  assert.ok(matchUse(board, 1));
  assert.equal(board.charge[1], 0, 'spent: set back from the win');
  assert.ok(!matchWon(board));
  matchEndTurn(board);
  assert.equal(matchEndTurn(board).spread, null, 'held back');
  assert.ok(matchUse(board, 0, 1), 'row 1 cleared');
  assert.ok(!board.cells.slice(5, 10).some(t => t.kind === 'crisis'));
  assert.ok(!matchUse(board, 0), 'needs a full meter');
  for (let i = 0; i < 20; i++) matchEndTurn(board);
  assert.ok(matchEndTurn(board).lost || matchCrisis(board) >= 8, 'the crisis takes it in the end');
});

test('Match boss phases (boss plan A): a won phase moves on to a fresh board, colours off in Dark, the last phase ends', async () => {
  const { matchGroups, matchSetup, matchEndTurn, matchUse, matchWon, matchCrisis, matchNextPhase, matchLastPhase, matchTints } = await import('../js/minigames.js');
  const { MATCH_BOSS } = await import('../js/config.js');
  reset();
  state.settings.activeData = BOSS_SET;
  const board = matchSetup(matchGroups());
  assert.equal(board.phase, 0);
  assert.ok(matchTints(board), 'Sort shows the kind colours');
  matchEndTurn(board);
  matchEndTurn(board);
  board.charge = [5, 5, 5];
  assert.ok(matchWon(board));
  assert.ok(!matchLastPhase(board));
  const turn = board.turn;
  assert.ok(matchNextPhase(board));
  assert.equal(board.phase, 1);
  assert.deepEqual(board.charge, [0, 0, 0], 'meters reset');
  assert.equal(matchCrisis(board), MATCH_BOSS.crisisStart.length, 'the crisis resets');
  assert.equal(board.toSpread, MATCH_BOSS.spreadEvery);
  assert.equal(board.turn, turn, 'the board does not start the clock or turns over');
  assert.ok(!matchTints(board), 'Dark: words only');
  board.charge = [5, 5, 5];
  assert.ok(matchUse(board, 2));
  assert.ok(matchTints(board), 'a crew member showing kinds lights them for a while');
  assert.ok(!matchLastPhase(board), 'Call comes after Dark');
  assert.ok(matchNextPhase(board));
  assert.equal(board.phase, 2);
  assert.ok(matchLastPhase(board), 'Call is the last phase');
  assert.ok(!matchNextPhase(board), 'no phase after the last');
  assert.equal(board.phase, 2);
});

// A Call board: phase 2, every tile a plain no-line pattern of `w<kind>`
// words, and the question's answer placed by hand at `at`.
async function callBoard(at) {
  const { matchGroups, matchSetup, matchNextPhase } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = BOSS_SET;
  const board = matchSetup(matchGroups());
  matchNextPhase(board);
  matchNextPhase(board);
  const T = k => ({ kind: k, word: 'w' + k });
  board.cells = Array.from({ length: 25 }, (_, i) => T(((i % 5) + 2 * Math.floor(i / 5)) % 3));
  board.cells[at] = { kind: board.ask.kind, word: board.ask.word };
  return board;
}

test('Match boss Call (boss plan B): the question is from the set, its answer is on the board, and not in a line', async () => {
  const { matchGroups, matchSetup, matchNextPhase, matchAnswerAt, matchRuns, matchWon, MATCH_CALL } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = BOSS_SET;
  for (let i = 0; i < 20; i++) {
    const board = matchSetup(matchGroups());
    assert.equal(board.ask, null, 'no question before Call');
    matchNextPhase(board);
    matchNextPhase(board);
    assert.equal(board.phase, MATCH_CALL);
    assert.ok(BOSS_SET.includes(board.ask.q), 'a set question');
    assert.equal(board.ask.word, board.ask.q.answer);
    assert.ok(board.groups[board.ask.kind].words.includes(board.ask.word));
    assert.equal(board.groups[board.ask.kind].key, board.ask.q.answerType, 'the kind of its answer type');
    const at = matchAnswerAt(board);
    assert.ok(at >= 0, 'the answer is on the board');
    assert.notEqual(board.cells[at].kind, 'crisis');
    assert.equal(matchRuns(board).length, 0, 'no line to start with');
    assert.equal(board.answers, 0);
    assert.ok(!matchWon(board), 'full meters do not win Call');
    board.charge = [5, 5, 5];
    assert.ok(!matchWon(board));
  }
});

test('Match boss Call: a line through the answer answers it and asks a new question; 3 answers win', async () => {
  const { matchSwap, matchWon, matchAnswerAt, matchEndTurn, matchHint } = await import('../js/minigames.js');
  const { MATCH_BOSS } = await import('../js/config.js');
  // Row 2 laid out as k k other answer(k) x: swapping 12 and 13 makes a
  // line of three through the answer.
  const board = await callBoard(12);
  const k = board.ask.kind;
  const T = x => ({ kind: x, word: 'w' + x });
  const other = (k + 1) % 3;
  board.cells.splice(10, 5, T(k), T(k), T(other), { kind: k, word: board.ask.word }, T((k + 2) % 3));
  board.cells[7] = T(other);
  board.cells[17] = T((k + 2) % 3);
  const first = board.ask;
  const got = matchSwap(board, 12, 13);
  assert.ok(got.lined);
  assert.equal(got.answered, first, 'the line runs through the answer');
  assert.equal(board.answers, 1);
  assert.notEqual(board.ask.q, first.q, 'a new question, never the same one twice');
  assert.ok(matchAnswerAt(board) >= 0, 'its answer is on the board');
  matchEndTurn(board);
  assert.equal(board.stuck, 0, 'the turn with an answer starts the ladder again');
  // A line that misses the answer is no answer.
  const b2 = await callBoard(24);
  const k2 = (b2.ask.kind + 1) % 3;
  b2.cells.splice(0, 5, T(k2), T(k2), T((k2 + 1) % 3), T(k2), T((k2 + 2) % 3));
  const miss = matchSwap(b2, 2, 3);
  assert.ok(miss.lined);
  assert.ok(!miss.waves[0].hit.includes(24), 'the first line is in row 0');
  // A chain could fall onto the answer by luck; only then is it answered.
  assert.equal(Boolean(miss.answered), miss.waves.slice(1).length > 0 && b2.answers === 1);
  // Three answers win.
  b2.answers = MATCH_BOSS.callAnswers - 1;
  assert.ok(!matchWon(b2));
  b2.answers++;
  assert.ok(matchWon(b2));
  assert.equal(matchHint(b2), 0, 'no hint at the start');
});

test('Match boss Call: the crisis never spreads onto the answer; the retry starts the answers again', async () => {
  const { matchEndTurn, matchAnswerAt, matchRetry, matchCrisis } = await import('../js/minigames.js');
  const { MATCH_BOSS } = await import('../js/config.js');
  for (let i = 0; i < 10; i++) {
    const board = await callBoard(12);
    // The answer is boxed in by the crisis: it still never spreads there.
    [6, 7, 8, 11, 13, 16, 17, 18].forEach((k) => { board.cells[k] = { kind: 'crisis', word: '!!' }; });
    for (let turn = 0; turn < 12; turn++) matchEndTurn(board);
    assert.notEqual(board.cells[12].kind, 'crisis');
    assert.equal(matchAnswerAt(board), 12);
    board.answers = 2;
    assert.ok(matchRetry(board));
    assert.equal(board.answers, 0, 'the phase starts again');
    assert.equal(board.phase, 2);
    assert.ok(matchAnswerAt(board) >= 0);
    assert.equal(matchCrisis(board), MATCH_BOSS.crisisStart.length);
  }
});

test('Match boss Call: the hint ladder climbs with turns stuck, one turn later per panic level', async () => {
  const { matchEndTurn, matchHint } = await import('../js/minigames.js');
  const board = await callBoard(12);
  board.skip = 99;
  const steps = (panic) => {
    board.stuck = 0;
    const at = [];
    for (let turn = 1; turn <= 12; turn++) {
      board.stuck = turn;
      at.push(matchHint(board, panic));
    }
    return [1, 2, 3].map(n => at.indexOf(n) + 1);
  };
  assert.deepEqual(steps(0), [2, 4, 6]);
  assert.deepEqual(steps(3), [5, 7, 9]);
  board.stuck = 0;
  matchEndTurn(board);
  matchEndTurn(board);
  assert.equal(board.stuck, 2, 'turns with no answer count');
  assert.equal(matchHint(board, 0), 1, 'its kind');
});

test('Match boss retry (boss plan A): the first loss restarts the same phase; there is only one', async () => {
  const { matchGroups, matchSetup, matchEndTurn, matchCrisis, matchNextPhase, matchRetry } = await import('../js/minigames.js');
  const { MATCH_BOSS } = await import('../js/config.js');
  reset();
  state.settings.activeData = BOSS_SET;
  const board = matchSetup(matchGroups());
  matchNextPhase(board);
  let lost = false;
  for (let i = 0; i < 40 && !lost; i++) lost = matchEndTurn(board).lost;
  assert.ok(lost);
  assert.ok(matchRetry(board), 'the first loss is retried');
  assert.equal(board.phase, 1, 'the same phase');
  assert.equal(matchCrisis(board), MATCH_BOSS.crisisStart.length);
  assert.deepEqual(board.charge, [0, 0, 0]);
  assert.ok(!matchRetry(board), 'no second retry');
});

test('Match boss: numbers never make a kind of tile (they give themselves away)', async () => {
  const { matchGroups } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = [...BOSS_SET, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(m => ({ question: 'How many?', answer: m, answerType: 'number' }))];
  assert.ok(!matchGroups().some(g => g.key === 'number'));
});

// ---- Patch Bay (facts list plan step E) ----

// A small triples set like the Bible file: David married two wives, so
// they can't share a board with him; Ruth has a fact of another predicate.
function person(id, name) { return { id, name, type: 'person', aliases: [] }; }
const P = Object.fromEntries([['david', 'David'], ['bathsheba', 'Bathsheba'], ['abigail', 'Abigail'], ['boaz', 'Boaz'], ['ruth', 'Ruth'],
  ['isaac', 'Isaac'], ['rebekah', 'Rebekah'], ['abraham', 'Abraham'], ['sarah', 'Sarah'], ['jacob', 'Jacob'], ['rachel', 'Rachel'],
  ['obed', 'Obed'], ['solomon', 'Solomon']].map(([id, name]) => [id, person(id, name)]));
const fact = (s, predicate, o) => ({ subject: P[s], predicate, object: typeof o === 'number' ? o : P[o] });
const PATCH_TRIPLES = {
  facts: [
    fact('david', 'married', 'bathsheba'), fact('david', 'married', 'abigail'), fact('boaz', 'married', 'ruth'),
    fact('isaac', 'married', 'rebekah'), fact('abraham', 'married', 'sarah'), fact('jacob', 'married', 'rachel'),
    fact('ruth', 'mother_of', 'obed'), fact('bathsheba', 'mother_of', 'solomon'), fact('sarah', 'age_at_promise', 90),
  ],
  labels: { married: '{subject}\'s wife', mother_of: '{object}\'s mother' },
};
const PORT = id => ({ id, name: id.toUpperCase(), type: 'protocol', aliases: [] });
const PORT_TRIPLES = {
  facts: [['http', 80], ['https', 443], ['ssh', 22], ['dns', 53], ['ftp', 21], ['smtp', 25]].map(([id, n]) => ({ subject: PORT(id), predicate: 'uses_port', object: n })),
  labels: { uses_port: '{subject} port' },
};

test('Patch Bay boards: no subject or object repeats, no plug fits two, the spare is a real free object', async () => {
  const { patchBayPredicates, patchBaySetup } = await import('../js/minigames.js');
  reset();
  state.settings.activeTriples = PATCH_TRIPLES;
  assert.deepEqual(patchBayPredicates(), ['married'], 'mother_of has only two pairs');
  const married = new Set(PATCH_TRIPLES.facts.filter(f => f.predicate === 'married').map(f => f.subject.id + '|' + f.object.id));
  for (let level = 0; level < 3; level++) {
    for (let n = 0; n < 30; n++) {
      const board = patchBaySetup('married', level);
      const lefts = board.left.map(l => l.subject.id);
      const rights = board.right.map(r => r.key);
      assert.equal(new Set(lefts).size, lefts.length, 'no subject twice');
      assert.equal(new Set(rights).size, rights.length, 'no object twice');
      board.left.forEach((l) => {
        const fits = board.right.filter(r => married.has(l.subject.id + '|' + r.key));
        assert.deepEqual(fits.map(r => r.id), [board.pairs[l.id]], l.text + ' fits exactly its own plug');
      });
      assert.ok(!(rights.includes('bathsheba') && rights.includes('abigail') && lefts.includes('david')), 'both of David\'s wives never show with him');
      const cables = MINIGAME_LEVELS.games.patchBay[level].cables;
      assert.equal(board.left.length, Math.min(cables, 5), 'as many cables as the level asks, while the facts have them');
      const spares = board.right.filter(r => !Object.values(board.pairs).includes(r.id));
      assert.ok(spares.length <= 1, 'one spare at most');
      spares.forEach(s => assert.ok(PATCH_TRIPLES.facts.some(f => f.predicate === 'married' && f.object.id === s.key), 'a spare is a real object of the predicate'));
      if (!MINIGAME_LEVELS.games.patchBay[level].spare) assert.equal(spares.length, 0, 'no spare below the top level');
    }
  }
});

test('Patch Bay: the spare plug shows at the top level when the predicate has a free object', async () => {
  const { patchBaySetup } = await import('../js/minigames.js');
  reset();
  state.settings.activeTriples = PORT_TRIPLES;
  const top = MINIGAME_LEVELS.games.patchBay.length - 1;
  for (let n = 0; n < 20; n++) {
    const board = patchBaySetup('uses_port', top);
    assert.equal(board.left.length, 5);
    assert.equal(board.right.length, 6, 'five partners and a spare');
  }
});

test('Patch Bay\'s nudge names no plug on the board, never the answer', async () => {
  const { patchBaySetup, patchBayNudge } = await import('../js/minigames.js');
  reset();
  for (const triples of [PATCH_TRIPLES, PORT_TRIPLES]) {
    state.settings.activeTriples = triples;
    const predicate = triples === PORT_TRIPLES ? 'uses_port' : 'married';
    for (let n = 0; n < 30; n++) {
      const board = patchBaySetup(predicate, n % 3);
      board.left.forEach((l) => {
        board.right.filter(r => r.id !== board.pairs[l.id]).forEach((wrong) => {
          const nudge = patchBayNudge(board, l.id, wrong.id);
          // A number nudge names the wrong plug ("higher than 80"), never another.
          const others = board.right.filter(r => triples === PATCH_TRIPLES || r.id !== wrong.id);
          others.forEach(r => assert.ok(!new RegExp('\\b' + r.text + '\\b').test(nudge), nudge + ' names ' + r.text));
        });
      });
    }
  }
  // Abraham's only other fact is Sarah's (the answer): it says there is no
  // other fact. Sarah's own age is a fact about her, not about Abraham.
  state.settings.activeTriples = PATCH_TRIPLES;
  for (let n = 0; n < 20; n++) {
    const board = patchBaySetup('married', 0);
    const abraham = board.left.find(l => l.subject.id === 'abraham');
    if (!abraham) continue;
    const wrong = board.right.find(r => r.id !== board.pairs[abraham.id]);
    assert.equal(patchBayNudge(board, abraham.id, wrong.id), t('mg.patchBay.noFact', { left: 'Abraham' }));
  }
});

test('Patch Bay\'s nudge uses a fact of another predicate, by its label', async () => {
  const { patchBaySetup, patchBayNudge } = await import('../js/minigames.js');
  reset();
  // A mother_of board (three mothers) where Ruth's other fact names Boaz,
  // who is not a plug on it.
  state.settings.activeTriples = {
    facts: [...PATCH_TRIPLES.facts, fact('rebekah', 'mother_of', 'jacob')],
    labels: PATCH_TRIPLES.labels,
  };
  const board = patchBaySetup('mother_of', 0);
  const ruth = board.left.find(l => l.subject.id === 'ruth');
  const wrong = board.right.find(r => r.id !== board.pairs[ruth.id]);
  assert.equal(patchBayNudge(board, ruth.id, wrong.id), t('mg.patchBay.fact', { label: 'Boaz\'s wife', value: 'Ruth' }));
});

test('Patch Bay\'s number nudge says higher or lower than the wrong plug', async () => {
  const { patchBaySetup, patchBayNudge } = await import('../js/minigames.js');
  reset();
  state.settings.activeTriples = PORT_TRIPLES;
  const board = patchBaySetup('uses_port', 0);
  const l = board.left[0];
  const want = Number(board.right.find(r => r.id === board.pairs[l.id]).text);
  board.right.filter(r => r.id !== board.pairs[l.id]).forEach((wrong) => {
    const nudge = patchBayNudge(board, l.id, wrong.id);
    assert.equal(nudge, t(want > Number(wrong.text) ? 'mg.patchBay.higher' : 'mg.patchBay.lower', { left: l.text, n: wrong.text }));
  });
});

test('Patch Bay\'s CHECK locks right cables, drops wrong ones, and scores by checks', async () => {
  const { patchBaySetup, patchBayCheck, patchBayTier } = await import('../js/minigames.js');
  reset();
  state.settings.activeTriples = PORT_TRIPLES;
  const board = patchBaySetup('uses_port', 0);
  const [a, b, c] = board.left.map(l => l.id);
  const first = patchBayCheck(board, { [a]: board.pairs[a], [b]: board.pairs[c], [c]: board.pairs[b] });
  assert.equal(board.checks, 1);
  assert.deepEqual(first.wrong.map(w => w.left), [b, c]);
  assert.ok(!first.solved);
  assert.ok(board.locked[a] && !board.locked[b]);
  const second = patchBayCheck(board, { [a]: board.pairs[a], [b]: board.pairs[b], [c]: board.pairs[c] });
  assert.ok(second.solved);
  assert.equal(patchBayTier(1), 'X');
  assert.equal(patchBayTier(2), '2');
  assert.equal(patchBayTier(PATCH_BAY.maxChecks), '1');
});

test('Patch Bay fits only its stand-in; the Signals officer sits out with no board', async () => {
  const { patchBayQuestion, roleCanRun } = await import('../js/minigames.js');
  reset();
  state.settings.activeTriples = { facts: [], labels: {} };
  assert.ok(!roleCanRun('patchBay'), 'no facts file: sits out');
  state.settings.activeTriples = { facts: PATCH_TRIPLES.facts.filter(f => f.predicate !== 'married'), labels: {} };
  assert.ok(!roleCanRun('patchBay'), 'no predicate with three clean pairs: sits out');
  state.settings.activeTriples = PATCH_TRIPLES;
  assert.ok(roleCanRun('patchBay'));
  assert.ok(SHIP_ONLY.includes('patchBay'));
  assert.ok(!minigamesFor(WORD).includes('patchBay'), 'a question of the set never runs it');
  const q = patchBayQuestion();
  assert.deepEqual(minigamesFor(q), ['patchBay'], 'its stand-in does');
  assert.equal(q.answer.split(', ').length, q.patchBay.left.length, 'its answer lists every pair');
});

test('Patch Bay grows a level with each perfect solve, up to its last', async () => {
  const { patchBaySetup, minigameLevel } = await import('../js/minigames.js');
  reset();
  state.settings.activeTriples = PORT_TRIPLES;
  state.run.ship = { perfect: {} };
  const levels = MINIGAME_LEVELS.games.patchBay;
  for (let k = 0; k < levels.length + 2; k++) {
    state.run.ship.perfect.patchBay = k;
    assert.equal(minigameLevel('patchBay'), Math.min(k, levels.length - 1));
    assert.equal(patchBaySetup('uses_port').left.length, levels[Math.min(k, levels.length - 1)].cables);
  }
  state.run.ship = null;
});

test('Practice settings: a picked or changed level is played, and only for its game', async () => {
  const { setPracticeSettings, levelOf, patchBaySetup, inferenceSetup } = await import('../js/minigames.js');
  reset();
  setPracticeSettings('starChart', { decoys: 3 });
  assert.equal(levelOf('starChart').decoys, 3);
  assert.deepEqual(levelOf('scanner'), MINIGAME_LEVELS.games.scanner[0], 'another game keeps its own level');
  state.settings.activeTriples = PORT_TRIPLES;
  setPracticeSettings('patchBay', { cables: 3, spare: true });
  const board = patchBaySetup('uses_port');
  assert.equal(board.left.length, 3);
  assert.equal(board.right.length, 4, 'three partners and a spare');
  setPracticeSettings('inference', { facts: 2, ops: [], three: false });
  state.settings.activeFacts = BIBLE_FACTS;
  assert.equal(Object.keys(inferenceSetup(BIBLE_FACTS[19], 4).facts).length, 2, 'the practice level, not level 5');
  setPracticeSettings(null);
  assert.deepEqual(levelOf('starChart'), MINIGAME_LEVELS.games.starChart[0], 'cleared, back to the run level');
});
