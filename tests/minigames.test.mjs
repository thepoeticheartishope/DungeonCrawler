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

import { withRandom } from './helpers.mjs';
import { freshLight } from '../js/battery.js';
import { state } from '../js/state.js';
import {
  MINIGAME_CHANCE, CLOSE_ENOUGH_REACH_MIN, CLOSE_ENOUGH_MIN_TOP, CLOSE_ENOUGH_MIN_STEPS, ENERGY_MAX, RELOAD_ENERGY,
  GATE_QUESTIONS, MINIGAME_TIER_PAY, HIGHER_LOWER_REACH_MIN, HIGHER_LOWER_MIN_TOP, HIGHER_LOWER_MIN_STEPS,
  SYLLABLE_SPLIT_DECOYS, LETTER_POOL_FORM, CODE_BREAK_TIERS, VERDICT_CLAIMS, VERDICT_BOSS_CLAIMS,
} from '../js/config.js';
import {
  MINIGAMES, MINIGAME_MODIFIERS, SHIP_ONLY, fuelMixSetup, fuelMixPour, fuelMixTier, fuelMixDry, minigamesFor, modifiersFor, rollMinigame, forcedQuestion, endMinigame,
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

test('every minigame supports at least two modifiers, but Sum Lock (a box carries none) and the ship-only ones', () => {
  for (const id of MINIGAMES) {
    if (id === 'sumLock' || SHIP_ONLY.includes(id)) assert.deepEqual(MINIGAME_MODIFIERS[id], []);
    else assert.ok(MINIGAME_MODIFIERS[id].length >= 2, id);
  }
});

test('Close Enough fits plain number answers only', () => {
  assert.deepEqual(minigamesFor(NUMBER), ['closeEnough', 'higherLower', 'fuelMix']);
  assert.deepEqual(minigamesFor({ meaning: '1,500%', answerType: 'number' }), ['closeEnough', 'higherLower', 'fuelMix']);
  assert.deepEqual(minigamesFor({ meaning: '4 B.C.', answerType: 'number' }), ['closeEnough', 'higherLower', 'fuelMix']);
  assert.deepEqual(minigamesFor(WORD), ['slowSpell', 'codeBreak', 'starChart', 'hullPatch'], 'a one-word name: no dial');
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
  assert.deepEqual(minigamesFor(NAMES[0]), ['slowSpell', 'codeBreak', 'starChart', 'hullPatch'], 'alone in the set: typed, so nothing to pick from');
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
  assert.deepEqual(minigamesFor(LONG[0]), ['slowSpell', 'syllableSplit', 'codeBreak', 'verdict', 'crosswire', 'starChart', 'hullPatch', 'asteroids']);
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

// ---- Fuel Mix (ship minigames plan step A) ----

test('Fuel Mix: tanks are powers of ten up to the answer, at least three, and a 5; par is the fewest pours', () => {
  assert.deepEqual(fuelMixSetup({ meaning: '13', answerType: 'number' }).tanks, [100, 10, 5, 1]);
  assert.deepEqual(fuelMixSetup({ meaning: '950', answerType: 'number' }).tanks, [100, 10, 5, 1]);
  assert.deepEqual(fuelMixSetup({ meaning: '1260', answerType: 'number' }).tanks, [1000, 100, 10, 5, 1]);
  assert.equal(fuelMixSetup({ meaning: '950', answerType: 'number' }).par, 14);
  assert.equal(fuelMixSetup({ meaning: '1,000', answerType: 'number' }).par, 1);
  assert.equal(fuelMixSetup({ meaning: '7', answerType: 'number' }).par, 3, '5 + 1 + 1');
  assert.equal(fuelMixSetup({ meaning: '19', answerType: 'number' }).par, 6, '10 + 5 + 1 x 4');
  assert.ok(minigamesFor(BIG).includes('fuelMix'), '144000 fits (tanks up to 100000)');
  assert.ok(!minigamesFor({ meaning: '7½', answerType: 'number' }).includes('fuelMix'));
  assert.ok(!minigamesFor(WORD).includes('fuelMix'));
});

test('Fuel Mix: a pour says only under, over (vent to empty) or match', () => {
  const e = fuelMixSetup({ meaning: '13', answerType: 'number' });
  assert.equal(fuelMixPour(e, 10), 'under');
  assert.equal(fuelMixPour(e, 10), 'over');
  assert.equal(e.total, 0, 'over vents the engine');
  assert.equal(e.vents, 1);
  assert.equal(fuelMixPour(e, 10), 'under');
  for (let i = 0; i < 2; i++) assert.equal(fuelMixPour(e, 1), 'under');
  assert.equal(fuelMixPour(e, 1), 'match');
});

test('Fuel Mix: tier by pours over par, vents counted; past the slack it runs dry', () => {
  const at = (pours, vents) => ({ ...fuelMixSetup({ meaning: '13', answerType: 'number' }), pours, vents });
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
  assert.deepEqual(scannerGrid(2), { cols: 10, rows: 8 }, 'a panicking crew gets a finer fog');
  assert.ok(ship.includes('scanner'));
  assert.ok(minigamesFor({ term: 'Which tool is shown?', meaning: 'Crimper', image: 'images/crimper.svg', answerType: 'term' }).includes('scanner'));
});

// ---- Star Chart (ship minigames plan step C) ----

test('Star Chart: the word\'s letters plus decoys not in it; more decoys when panicking', async () => {
  const { starChartSetup } = await import('../js/minigames.js');
  const q = { term: 'What king wanted to kill baby Jesus?', meaning: 'Herod', answerType: 'name' };
  const calm = starChartSetup(q, 0);
  assert.equal(calm.word, 'HEROD');
  assert.equal(calm.stars.length, 5 + 6);
  const decoys = calm.stars.map(s => s.letter).filter(c => !'HEROD'.includes(c));
  assert.equal(decoys.length, 6, 'decoys are letters not in the word');
  assert.equal(starChartSetup(q, 2).stars.length, 5 + 10);
  calm.stars.forEach(s => assert.ok(s.x > 0 && s.x < 100 && s.y > 0 && s.y < 100));
  assert.ok(!minigamesFor({ meaning: 'Lot\'s wife', answerType: 'related' }).includes('starChart'), 'one word of plain letters only');
  assert.ok(!minigamesFor({ term: 'Spell Noah.', meaning: 'Noah', answerType: 'name' }).includes('starChart'), 'not when the stem holds it');
});

test('Star Chart: picks join in order; a wrong star goes dark; tiers by wrong stars', async () => {
  const { starChartSetup, starChartPick, starChartTier } = await import('../js/minigames.js');
  const chart = starChartSetup({ term: 'Who?', meaning: 'Lot', answerType: 'name' }, 0);
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

test('Hull Patch: the tray holds the word\'s letters once each plus decoys; a panicking hull holds less', async () => {
  const { hullPatchSetup } = await import('../js/minigames.js');
  const q = { term: 'Which Caesar reigned?', meaning: 'Tiberius', answerType: 'name' };
  const hull = hullPatchSetup(q, 0);
  assert.equal(hull.word, 'TIBERIUS');
  assert.equal(hull.tray.length, 7 + 7, 'T I B E R U S once each, and 7 decoys');
  assert.equal(new Set(hull.tray).size, hull.tray.length, 'no plate twice');
  assert.equal(hull.max, 5);
  assert.equal(hullPatchSetup(q, 2).max, 3);
});

test('Hull Patch: a right plate fills every spot, a wrong one strains; breach at the max; tiers by strain', async () => {
  const { hullPatchSetup, hullPatchPlate, hullPatchTier } = await import('../js/minigames.js');
  const hull = hullPatchSetup({ term: 'Who?', meaning: 'Anna', answerType: 'name' }, 0);
  assert.equal(hullPatchPlate(hull, 'A'), 'fits', 'both As at once');
  assert.equal(hullPatchPlate(hull, 'A'), 'used');
  assert.equal(hullPatchPlate(hull, 'Z'), 'off');
  assert.equal(hull.strain, 1);
  assert.equal(hullPatchPlate(hull, 'N'), 'sealed');
  const weak = hullPatchSetup({ term: 'Who?', meaning: 'Anna', answerType: 'name' }, 2);
  assert.equal(hullPatchPlate(weak, 'B'), 'off');
  assert.equal(hullPatchPlate(weak, 'C'), 'off');
  assert.equal(hullPatchPlate(weak, 'D'), 'breach', 'a panicking hull breaches at 3');
  assert.equal(hullPatchTier(0), 'X');
  assert.equal(hullPatchTier(2), '2');
  assert.equal(hullPatchTier(4), '1');
});

// ---- Inference (ship minigames plan step E) ----

const LABELLED = [
  { term: 'Pentateuch?', meaning: '5', answerType: 'number', label: 'Books of the Pentateuch' },
  { term: 'Loaves?', meaning: '7', answerType: 'number', label: 'Loaves that fed the 4,000' },
  { term: 'Moses?', meaning: '40', answerType: 'number', label: 'Days Moses spent on the mountain' },
  { term: 'Elders?', meaning: '24', answerType: 'number', label: 'Elders around the throne' },
  { term: 'Gates?', meaning: '12', answerType: 'number', label: 'Gates of the New Jerusalem' },
];

test('Inference fits a labelled number question with two other labelled facts to help', async () => {
  reset();
  state.settings.activeData = LABELLED.slice(0, 2);
  assert.ok(!minigamesFor(LABELLED[0]).includes('inference'), 'one helper is not enough');
  state.settings.activeData = LABELLED;
  assert.ok(minigamesFor(LABELLED[2]).includes('inference'));
  assert.ok(!minigamesFor(NUMBER).includes('inference'), 'no label, no tile');
});

const BIBLE_FACTS = [[5, 'Pentateuch'], [70, 'Babylon'], [9, 'Beatitudes'], [50, 'Jubilee'], [17, 'Joseph'], [20, 'Judah'],
  [13, 'Jericho'], [30, 'Judas'], [8, 'Ark'], [7, 'Loaves'], [90, 'Sarah'], [100, 'Abraham'], [3, 'Nineveh'], [21, 'Epistles'],
  [4, 'Soldiers'], [12, 'Gates'], [39, 'OT books'], [24, 'Elders'], [19, 'Kings'], [40, 'Moses']]
  .map(([n, label]) => ({ term: label + '?', meaning: String(n), answerType: 'number', label }));

test('Inference: at every level each line brings in one new symbol, the truth holds, a wrong answer breaks a line', async () => {
  const { inferenceSetup, inferenceCheck, inferenceValue } = await import('../js/minigames.js');
  const { INFERENCE } = await import('../js/config.js');
  reset();
  for (const data of [LABELLED, BIBLE_FACTS]) {
    state.settings.activeData = data;
    INFERENCE.levels.forEach((lv, level) => {
      const used = new Set();
      for (let n = 0; n < 60; n++) {
        const q = data[n % data.length];
        const puzzle = inferenceSetup(q, level);
        const ids = Object.keys(puzzle.facts);
        assert.ok(ids.length <= lv.facts && ids.includes('T'));
        const truth = Object.fromEntries(ids.map(id => [id, puzzle.facts[id].value]));
        assert.equal(truth.T, Number(q.meaning));
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

test('Inference grows with the run: every INFERENCE.solvesPerLevel puzzles solved on the ship is a level up, to the last', async () => {
  const { inferenceLevel, inferenceSetup, inferenceCheck, inferenceTier } = await import('../js/minigames.js');
  const { INFERENCE } = await import('../js/config.js');
  reset();
  state.settings.activeData = BIBLE_FACTS;
  state.run.ship = { inferenceSolved: 0 };
  assert.equal(inferenceLevel(), 0);
  const per = INFERENCE.solvesPerLevel;
  for (let k = 0; k < (INFERENCE.levels.length + 1) * per; k++) {
    const puzzle = inferenceSetup(BIBLE_FACTS[19]);
    assert.equal(puzzle.level, Math.min(Math.floor(k / per), INFERENCE.levels.length - 1));
    inferenceCheck(puzzle, Object.fromEntries(Object.entries(puzzle.facts).map(([id, f]) => [id, f.value])));
  }
  assert.equal(inferenceLevel(), INFERENCE.levels.length - 1);
  state.run.ship = null;
  assert.equal(inferenceTier(1), 'X');
  assert.equal(inferenceTier(2), '2');
  assert.equal(inferenceTier(4), '1');
});

// ---- Asteroids (ship minigames plan step F) ----

test('Asteroids: the right rock and decoys of its kind, each a real answer; more rocks when panicking', async () => {
  const { asteroidsSetup } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = [...NAMES, BOOK];
  const q = NAMES[0];
  const calm = asteroidsSetup(q, 0);
  assert.equal(calm.rocks.length, 4);
  assert.equal(calm.rocks.filter(r => r.right).length, 1);
  assert.equal(calm.rocks[0].text, q.meaning, 'the right rock comes first; the view mixes them');
  calm.rocks.slice(1).forEach((r) => {
    const from = NAMES.find(n => n.meaning === r.text);
    assert.ok(from, 'a decoy is another answer in the set');
    assert.equal(r.asks, from.term, 'and says what it is the answer to');
  });
  assert.equal(asteroidsSetup(q, 2).rocks.length, Math.min(6, NAMES.length));
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
  ...['Ruth', 'Acts', 'Jude', 'Amos', 'Joel', 'Ezra', 'Luke'].map(m => ({ term: 'Which book?', meaning: m, answerType: 'book' })),
  ...['Rome', 'Eden', 'Moab', 'Edom', 'Joppa', 'Nebo', 'Egypt'].map(m => ({ term: 'Where?', meaning: m, answerType: 'location' })),
  ...['Paul', 'Herod', 'Lot', 'Aaron', 'Silas', 'Jacob', 'Saul', 'Eli'].map(m => ({ term: 'Who?', meaning: m, answerType: 'name' })),
  { term: 'Long?', meaning: 'Nebuchadnezzar', answerType: 'name' },
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

test('Match boss: numbers never make a kind of tile (they give themselves away)', async () => {
  const { matchGroups } = await import('../js/minigames.js');
  reset();
  state.settings.activeData = [...BOSS_SET, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(m => ({ term: 'How many?', meaning: m, answerType: 'number' }))];
  assert.ok(!matchGroups().some(g => g.key === 'number'));
});
