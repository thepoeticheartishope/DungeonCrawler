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
} from './config.js';
import { numberQuestion, pickQuestion } from './quiz.js';

// The modifiers each minigame supports (the plan's compatibility table).
// A minigame only ever carries modifiers from its own list, so none is
// forced on it or means nothing there. Each needs at least two, so a
// reload offer or a hunter pair can be built from it.
export const MINIGAME_MODIFIERS = {
  closeEnough: ['blind', 'flip', 'timer', 'gambler'],
};

export const MINIGAMES = Object.keys(MINIGAME_MODIFIERS);

// Whether each minigame can run a question.
const FITS = {
  closeEnough: q => closeEnoughAnswer(q) !== null,
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
