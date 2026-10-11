// Minigames (minigames plan, ideas/minigames-plan.md): sometimes a question
// runs as a small game instead of a pick from four answers. This file
// decides which minigames fit a question, rolls whether one runs, keeps
// to the modifiers each one supports, and holds each minigame's rules
// (its setup and how a result scores). main.js rolls through
// rollMinigame() wherever a question is asked; minigameview.js draws the
// minigame and scores it here. No DOM access here.
//
// A result is { right, tier, given }: tier '1' (a weak hit), '2' (as good
// as a plain right answer) or 'X' (perfect), or null on a miss. The settle
// rules (answers.js, gun.js, relays.js) take the tier and pay it
// (MINIGAME_TIER_PAY in config.js).

import { state } from './state.js';
import {
  MINIGAME_CHANCE, CLOSE_ENOUGH_REACH_MIN, CLOSE_ENOUGH_REACH_MAX, CLOSE_ENOUGH_MIN_TOP, CLOSE_ENOUGH_MIN_STEPS,
  CLOSE_ENOUGH_BANDS, CLOSE_ENOUGH_SMALL, CLOSE_ENOUGH_SMALL_OFF,
  HIGHER_LOWER_REACH_MIN, HIGHER_LOWER_REACH_MAX, HIGHER_LOWER_MIN_TOP, HIGHER_LOWER_MIN_STEPS, HIGHER_LOWER_MAX_AT,
  HIGHER_LOWER_TIERS, SLOW_SPELL_MIN_LETTERS, SLOW_SPELL_MAX_LETTERS, SLOW_SPELL_DECOYS, SLOW_SPELL_X_SHOWN,
} from './config.js';
import { numberQuestion, pickQuestion, shuffle, normalizeSpaces } from './quiz.js';

// The modifiers each minigame supports (the plan's compatibility table).
// A minigame only ever carries modifiers from its own list, so none is
// forced on it or means nothing there. Each needs at least two, so a
// reload offer or a hunter pair can be built from it.
export const MINIGAME_MODIFIERS = {
  closeEnough: ['blind', 'flip', 'timer', 'gambler'],
  higherLower: ['blind', 'flip', 'timer', 'gambler'],
  // No Timer: waiting for letters is the game.
  slowSpell: ['blind', 'flip', 'gambler'],
};

export const MINIGAMES = Object.keys(MINIGAME_MODIFIERS);

// Whether each minigame can run a question.
const FITS = {
  closeEnough: q => closeEnoughAnswer(q) !== null,
  higherLower: q => higherLowerAnswer(q) !== null,
  slowSpell: q => spellable(q.meaning) && slowSpellDecoys(q).length >= SLOW_SPELL_DECOYS,
};

// The minigames that can run question `q`.
export function minigamesFor(q) {
  if (!q) return [];
  return MINIGAMES.filter(id => FITS[id](q));
}

// The modifiers `offered` with a question (none, one, or a pair) that
// `minigame` can carry: all of them, or null when it can't carry one of
// them. Dropping one instead would hand out a reload's energy for a
// modifier never faced, so the offer stays a plain question.
export function modifiersFor(minigame, offered) {
  const list = [].concat(offered || []).filter(Boolean);
  return list.every(m => MINIGAME_MODIFIERS[minigame].includes(m)) ? list : null;
}

// Whether question `q`, asked with modifiers `offered`, runs as a
// minigame: MINIGAME_CHANCE, if a minigame fits it and its modifiers, and
// never the one that ran last (state.run.lastMinigame; a plain question
// clears it, so "last" means the question before). DEV -> Minigame can
// turn them off or force one (state.settings.minigame). Sets
// state.battle.minigame to the one picked, or null, and returns it.
export function rollMinigame(q, offered) {
  const picked = pickMinigame(q, offered);
  state.battle.minigame = picked;
  state.run.lastMinigame = picked;
  return picked;
}

// rollMinigame's choice, without recording it.
function pickMinigame(q, offered) {
  const mode = state.settings.minigame;
  if (mode === 'off') return null;
  const fits = minigamesFor(q).filter(id => modifiersFor(id, offered));
  if (mode !== 'roll') return fits.includes(mode) ? mode : null;
  const fresh = fits.filter(id => id !== state.run.lastMinigame);
  if (!fresh.length || Math.random() >= MINIGAME_CHANCE) return null;
  return fresh[Math.floor(Math.random() * fresh.length)];
}

// With DEV -> Minigame forcing one, a question it can't run is swapped for
// one from `pool` it can, or from the whole set when `pool` has none (a
// reload's category is often one answer type), so the minigame can be
// tried in any fight or reload. Otherwise `q` stays.
export function forcedQuestion(q, pool) {
  const mode = state.settings.minigame;
  if (!FITS[mode] || FITS[mode](q)) return q;
  const inPool = (pool || []).filter(FITS[mode]);
  const fitting = inPool.length ? inPool : state.settings.activeData.filter(FITS[mode]);
  return fitting.length ? pickQuestion(q, fitting) : q;
}

// The minigame showing has ended with `result`. Clears
// state.battle.minigame.
// Events: minigameScored { minigame, tier, given, answer }.
export function endMinigame(result) {
  const minigame = state.battle.minigame;
  state.battle.minigame = null;
  return [{ type: 'minigameScored', minigame, tier: result.tier, given: result.given, answer: state.battle.currentQuestion.meaning }];
}

// ---- Close Enough: set a dial to a number answer ----

// The number Close Enough sets the dial to: a number question's answer
// above 0, with no unit or a plain one ("%", "B.C."), or null. "7½" and
// "13 and 14" don't fit a dial.
function closeEnoughAnswer(q) {
  const n = numberQuestion(q);
  if (!n || n.value <= 0 || !/^[a-z%. ]*$/.test(n.unit)) return null;
  return n;
}

// A new dial for question `q` (one Close Enough can run): from 0 to `top`
// in `steps` steps of `step`, the answer at step `answerAt`, and the
// answer's `unit` to show beside the reading.
export function closeEnoughDial(q) {
  const { value, unit } = closeEnoughAnswer(q);
  const reach = CLOSE_ENOUGH_REACH_MIN + Math.random() * (CLOSE_ENOUGH_REACH_MAX - CLOSE_ENOUGH_REACH_MIN);
  const top = Math.max(CLOSE_ENOUGH_MIN_TOP, roundUp(value * reach));
  let power = Math.floor(Math.log10(top / CLOSE_ENOUGH_MIN_STEPS));
  while (!landsOn(value, 10 ** power)) power--;
  // A whole-number answer gets a whole-number dial.
  if (power < 0 && landsOn(value, 1)) power = 0;
  const step = 10 ** power;
  return { answer: value, unit, top, step, steps: Math.round(top / step), answerAt: Math.round(value / step) };
}

// `x` rounded up to a round number: 1, 1.5, 2, 2.5 ... times a power of ten.
function roundUp(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  return Math.ceil(x / p * 2) / 2 * p;
}

// Whether `value` is a whole number of `step`s (allowing for float error).
function landsOn(value, step) {
  const n = value / step;
  return Math.abs(n - Math.round(n)) < 1e-6;
}

// The tier for the dial stopped at step `at`: 'X' on the answer, '2'
// within CLOSE_ENOUGH_BANDS[2] of it, '1' within CLOSE_ENOUGH_BANDS[1],
// else null (a miss). Answers under CLOSE_ENOUGH_SMALL have one band:
// CLOSE_ENOUGH_SMALL_OFF either side = '2'.
export function closeEnoughTier(dial, at) {
  if (at === dial.answerAt) return 'X';
  const off = Math.abs(at - dial.answerAt) * dial.step;
  const slack = dial.step / 1000;
  if (dial.answer < CLOSE_ENOUGH_SMALL) return off <= CLOSE_ENOUGH_SMALL_OFF + slack ? '2' : null;
  if (off <= dial.answer * CLOSE_ENOUGH_BANDS[2] + slack) return '2';
  if (off <= dial.answer * CLOSE_ENOUGH_BANDS[1] + slack) return '1';
  return null;
}

// ---- Higher / Lower: find a number answer in a few guesses ----

// The number Higher / Lower hunts for: a whole number Close Enough could
// dial, no finer than HIGHER_LOWER_MAX_AT steps of its roundest step (40
// is 4 tens, 37 is 37 ones; 1453 would be a bar of thousands), or null.
function higherLowerAnswer(q) {
  const n = closeEnoughAnswer(q);
  if (!n || !Number.isInteger(n.value) || n.value / niceSteps(n.value)[0] > HIGHER_LOWER_MAX_AT) return null;
  return n;
}

// The round steps (1, 2, 5, 10, 20, 50 ...) a whole number `n` is a whole
// number of, largest first.
function niceSteps(n) {
  const steps = [];
  for (let p = 1; p <= n; p *= 10) {
    for (const s of [p, 2 * p, 5 * p]) if (s <= n && n % s === 0) steps.push(s);
  }
  return steps.reverse();
}

// A new bar for question `q` (one Higher / Lower can run): from 0 to `top`
// in `steps` steps of `step`, the answer at step `answerAt`, and the
// answer's `unit`. The same shape as Close Enough's dial. The step is the
// largest round step that lands on the answer and still leaves at least
// HIGHER_LOWER_MIN_STEPS steps.
export function higherLowerBar(q) {
  const { value, unit } = higherLowerAnswer(q);
  const reach = HIGHER_LOWER_REACH_MIN + Math.random() * (HIGHER_LOWER_REACH_MAX - HIGHER_LOWER_REACH_MIN);
  const top = Math.max(HIGHER_LOWER_MIN_TOP, roundUp(value * reach));
  const step = niceSteps(value).find(s => top % s === 0 && top / s >= HIGHER_LOWER_MIN_STEPS) || 1;
  return { answer: value, unit, top, step, steps: top / step, answerAt: value / step };
}

// What a guess at step `at` hears: 'hit', 'higher' or 'lower'.
export function higherLowerHint(bar, at) {
  if (at === bar.answerAt) return 'hit';
  return at < bar.answerAt ? 'higher' : 'lower';
}

// The tier for a hit on guess `n` (1 = the first): HIGHER_LOWER_TIERS in
// order, null past the last (a miss).
export function higherLowerTier(n) {
  return HIGHER_LOWER_TIERS[n - 1] || null;
}

// ---- Slow Spell: the answer's letters fill in one at a time ----

// One word: letters, with a hyphen or apostrophe inside at most.
const ONE_WORD = /^\p{L}[\p{L}'-]*$/u;

// How many letters `answer` has (a hyphen or apostrophe is not one).
function letterCount(answer) {
  return answer.replace(/[^\p{L}]/gu, '').length;
}

// Whether `answer` can be spelled out in blanks: one word of
// SLOW_SPELL_MIN_LETTERS to SLOW_SPELL_MAX_LETTERS letters. Shorter ones
// give themselves away in a letter or two; longer ones don't fit a phone.
function spellable(answer) {
  const word = String(answer || '').trim();
  const n = letterCount(word);
  return ONE_WORD.test(word) && n >= SLOW_SPELL_MIN_LETTERS && n <= SLOW_SPELL_MAX_LETTERS;
}

// The wrong options Slow Spell can offer for `q`: the set's other one-word
// answers of the same type with as many letters, each spelling once. The
// blanks show the length, so a decoy of another length would be no
// decoy at all.
function slowSpellDecoys(q) {
  const key = s => normalizeSpaces(s).toLowerCase();
  const n = letterCount(q.meaning);
  const seen = new Set([key(q.meaning)]);
  const decoys = [];
  for (const d of state.settings.activeData) {
    if (d.answerType !== q.answerType || !spellable(d.meaning) || letterCount(d.meaning) !== n) continue;
    if (seen.has(key(d.meaning))) continue;
    seen.add(key(d.meaning));
    decoys.push(d.meaning.trim());
  }
  return decoys;
}

// A new spelling for question `q` (one Slow Spell can run): its `chars`,
// the letter places in the order they fill in (`order`, a hyphen or
// apostrophe shows from the start), the letter count (`total`), how many
// fill in before the options open on their own (`stopAt`: all but one,
// so the answer is never simply read off), and the `choices` once I KNOW
// IT is pressed: the answer and SLOW_SPELL_DECOYS decoys of its length.
export function slowSpellWord(q) {
  const chars = [...q.meaning.trim()];
  const places = chars.map((c, i) => i).filter(i => /\p{L}/u.test(chars[i]));
  const decoys = shuffle(slowSpellDecoys(q)).slice(0, SLOW_SPELL_DECOYS);
  return {
    chars,
    order: shuffle(places),
    total: places.length,
    stopAt: places.length - 1,
    choices: shuffle([q.meaning.trim(), ...decoys]),
  };
}

// The tier for an answer picked with `shown` of `total` letters filled
// in: 'X' for at most SLOW_SPELL_X_SHOWN, '2' for at most half, else '1'.
// A wrong pick is a miss whatever was shown.
export function slowSpellTier(shown, total) {
  if (shown <= SLOW_SPELL_X_SHOWN) return 'X';
  return shown <= Math.floor(total / 2) ? '2' : '1';
}
