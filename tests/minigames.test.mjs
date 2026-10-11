// Unit tests for minigames.js (minigames plan steps A-E): which questions a
// minigame fits, the roll (chance, no repeats, DEV -> Minigame), the
// modifiers a minigame keeps, Close Enough's dial and bands, Higher /
// Lower's bar, hints and tiers, Slow Spell's fit, spelling and tiers,
// Syllable Split's splitter, fit, tray and tiers, Letter Pool's roll,
// tray, checks, tiers and no haunts, and what a
// tier pays in the settle rules (gun.js, answers.js).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import {
  MINIGAME_CHANCE, CLOSE_ENOUGH_REACH_MIN, CLOSE_ENOUGH_MIN_TOP, CLOSE_ENOUGH_MIN_STEPS, ENERGY_MAX, RELOAD_ENERGY,
  BOSS_HP, MINIGAME_TIER_PAY, HIGHER_LOWER_REACH_MIN, HIGHER_LOWER_MIN_TOP, HIGHER_LOWER_MIN_STEPS,
  SYLLABLE_SPLIT_DECOYS, LETTER_POOL_FORM,
} from '../js/config.js';
import {
  MINIGAMES, MINIGAME_MODIFIERS, minigamesFor, modifiersFor, rollMinigame, forcedQuestion, endMinigame,
  closeEnoughDial, closeEnoughTier, higherLowerBar, higherLowerHint, higherLowerTier, slowSpellWord, slowSpellTier, slowSpellMatches,
  splitSyllables, syllableSplitPieces, syllableSplitTray, syllableSplitTier,
  letterPoolSetup, letterPoolCheck, letterPoolTier,
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

test('every minigame supports at least two modifiers', () => {
  for (const id of MINIGAMES) assert.ok(MINIGAME_MODIFIERS[id].length >= 2, id);
});

test('Close Enough fits plain number answers only', () => {
  assert.deepEqual(minigamesFor(NUMBER), ['closeEnough', 'higherLower']);
  assert.deepEqual(minigamesFor({ meaning: '1,500%', answerType: 'number' }), ['closeEnough', 'higherLower']);
  assert.deepEqual(minigamesFor({ meaning: '4 B.C.', answerType: 'number' }), ['closeEnough', 'higherLower']);
  assert.deepEqual(minigamesFor(WORD), ['slowSpell'], 'a one-word name: only Slow Spell');
  assert.deepEqual(minigamesFor({ meaning: '7½', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ meaning: '13 and 14', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ meaning: '0', answerType: 'number' }), []);
  assert.deepEqual(minigamesFor({ meaning: '1 Corinthians', answerType: 'book' }), []);
  assert.deepEqual(minigamesFor({ meaning: '443', answerType: 'port' }), [], 'a port is a label, not an amount');
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
  assert.deepEqual(minigamesFor(NAMES[0]), ['slowSpell'], 'alone in the set: typed, so nothing to pick from');
  state.settings.activeData = [...NAMES, BOOK];
  assert.ok(!minigamesFor(NAMES[6]).includes('slowSpell'), 'Eve: too short');
  assert.deepEqual(minigamesFor({ term: 'Who?', meaning: 'John Mark', answerType: 'name' }), [], 'two words');
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
  assert.deepEqual(minigamesFor(LONG[0]), ['slowSpell', 'syllableSplit']);
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
  assert.deepEqual(events.map(e => e.type), ['jammed']);
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
  // More HP than BOSS_HP, so neither answer clears it.
  const hp = BOSS_HP + 2;
  state.floor.boss = { row: 1, col: 1, hp, kind: 'boss' };
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
