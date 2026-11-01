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
  PORT_LIKE_TYPES, HIGHER_LOWER_TIERS, FUEL_MIX, SCANNER, STAR_CHART, SLOW_SPELL_MIN_LETTERS, SLOW_SPELL_MAX_LETTERS, SLOW_SPELL_X_SHOWN,
  SYLLABLE_SPLIT_MIN_PIECES, SYLLABLE_SPLIT_DECOYS, SYLLABLE_SPLIT_TIERS,
  CODE_BREAK_MIN_CHARS, CODE_BREAK_MAX_CHARS, CODE_BREAK_TIERS,
  VERDICT_CLAIMS, VERDICT_BOSS_CLAIMS, VERDICT_TIERS, VERDICT_BOSS_TIERS, VERDICT_FALSE_SHARE, VERDICT_MIN_DECOYS,
  CROSSWIRE_MIN_LETTERS, CROSSWIRE_MAX_LETTERS, CROSSWIRE_TIERS, FOG_REVEAL_X_COVERED, FOG_REVEAL_2_COVERED,
  SUM_LOCK_MAX_ADDEND,
  LETTER_POOL_FORM, LETTER_POOL_WEAK, LETTER_POOL_MIN_LETTERS, LETTER_POOL_MAX_LETTERS, SHIP_JOB, BATTLE_CHOICE_COUNT,
} from './config.js';
import { numberQuestion, pickQuestion, normalizeSpaces, fightGroups } from './quiz.js';
import { shuffle } from './random.js';
import { recordHauntAnswer } from './haunts.js';

// The modifiers each minigame supports (the plan's compatibility table).
// A minigame only ever carries modifiers from its own list, so none is
// forced on it or means nothing there. Each needs at least two, so a
// reload offer or a hunter pair can be built from it.
export const MINIGAME_MODIFIERS = {
  closeEnough: ['blind', 'flip', 'timer', 'gambler'],
  higherLower: ['blind', 'flip', 'timer', 'gambler'],
  // No Timer: waiting for letters is the game.
  slowSpell: ['blind', 'flip', 'gambler'],
  syllableSplit: ['blind', 'flip', 'timer', 'gambler'],
  letterPool: ['blind', 'flip', 'timer', 'gambler'],
  codeBreak: ['blind', 'flip', 'timer', 'gambler'],
  verdict: ['blind', 'flip', 'timer', 'gambler'],
  // No Flip: no fair version for a typed grid.
  crosswire: ['blind', 'timer', 'gambler'],
  // No Timer (waiting is the game) and no Blind (the picture is the
  // question).
  fogReveal: ['flip', 'gambler'],
  // A trapped box carries no modifiers, so neither does its lock.
  sumLock: [],
  // A ship role's game only (SHIP_ONLY): the ship asks with no modifiers.
  fuelMix: [],
  scanner: [],
  starChart: [],
};

// Minigames only the ship's crew roles run (ship minigames plan): never
// rolled in place of a question elsewhere.
export const SHIP_ONLY = ['fuelMix', 'scanner', 'starChart'];

export const MINIGAMES = Object.keys(MINIGAME_MODIFIERS);

// Whether each minigame can run a question.
const FITS = {
  closeEnough: q => closeEnoughAnswer(q) !== null,
  higherLower: q => higherLowerAnswer(q) !== null,
  slowSpell: q => spellable(q.meaning) && !answerInStem(q),
  syllableSplit: q => {
    const pieces = !answerInStem(q) && syllableSplitPieces(q);
    return Boolean(pieces) && pieceDecoys(pieces).length >= SYLLABLE_SPLIT_DECOYS;
  },
  // Letter Pool runs a category, not a question: only its own stand-in
  // question (letterPoolQuestion in main.js) fits it.
  letterPool: q => Boolean(q.letterPool),
  codeBreak: q => codeBreakCode(q) !== null && !answerInStem(q),
  verdict: q => verdictFits(q) && verdictIndex().fitting.length >= VERDICT_BOSS_CLAIMS,
  crosswire: q => crosswirePartners(q).length > 0,
  fogReveal: q => Boolean(String(q.image || '').trim()),
  // Sum Lock runs a trapped box, not a question: only its own stand-in
  // question (sumLockQuestion in main.js) fits it.
  sumLock: q => Boolean(q.sumLock),
  fuelMix: q => fuelMixAnswer(q) !== null,
  scanner: q => Boolean(String(q.image || '').trim()),
  starChart: q => starChartWord(q) !== null && !answerInStem(q),
};

// Whether question `q`'s wording holds its own answer ("Spell
// Bartimaeus."): a minigame that spells the answer out would be free.
function answerInStem(q) {
  return String(q.term || '').toLowerCase().includes(String(q.meaning || '').trim().toLowerCase());
}

// Whether `minigame` can be a ship crew role's job on the loaded set (crew
// roles plan; roles.js): Letter Pool needs a category it can run, Sum Lock
// two number answers to add, any other enough questions it fits
// (SHIP_JOB.minFitting). One that can't, its role sits out the run.
export function roleCanRun(minigame) {
  const data = state.settings.activeData || [];
  if (minigame === 'letterPool') return roleGroups().length > 0;
  if (minigame === 'sumLock') return sumLockQuestions().length >= 2;
  return data.filter(FITS[minigame]).length >= SHIP_JOB.minFitting;
}

// The questions of the loaded set `minigame` can run (a role's job asks
// these), or for Letter Pool the categories it can run (roleGroups).
export function roleQuestions(minigame) {
  return (state.settings.activeData || []).filter(FITS[minigame]);
}

// The set's categories a Letter Pool can run, for the Cook's job.
export function roleGroups() {
  return fightGroups(state.settings.activeData || [], BATTLE_CHOICE_COUNT).filter(letterPoolFits);
}

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
// `group` is the category `q` was picked from ({ label, pool }), when the
// player picked one (a reload, a fight's choice): Letter Pool can run it
// in place of the question, one more minigame in the same roll. Picked,
// the caller asks letterPoolSetup(group) instead of `q`.
export function rollMinigame(q, offered, group = null) {
  const picked = pickMinigame(q, offered, group);
  state.battle.minigame = picked;
  state.run.lastMinigame = picked;
  return picked;
}

// rollMinigame's choice, without recording it.
// A trapped box that rolls one runs Sum Lock when it can, since that is
// its own; never twice in a row, like any other.
function pickMinigame(q, offered, group) {
  const mode = state.settings.minigame;
  if (mode === 'off') return null;
  // DEV -> Minigame may force a ship-only one; a roll never picks one.
  const ids = minigamesFor(q).filter(id => mode !== 'roll' || !SHIP_ONLY.includes(id));
  if (letterPoolFits(group)) ids.push('letterPool');
  if (sumLockFits()) ids.push('sumLock');
  const fits = ids.filter(id => modifiersFor(id, offered));
  if (mode !== 'roll') return fits.includes(mode) ? mode : null;
  const fresh = fits.filter(id => id !== state.run.lastMinigame);
  if (!fresh.length || Math.random() >= MINIGAME_CHANCE) return null;
  if (fresh.includes('sumLock')) return 'sumLock';
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
// state.battle.minigame. A minigame that asked more questions than the
// one showing (Verdict) lists the ones missed in `result.missed`: each
// becomes a haunt like any missed question. The one showing is left to
// the settle rule, which records it by the result as a whole.
// Events: minigameScored { minigame, tier, given, answer }, then
// hauntLingers for each missed one that was a haunt already.
export function endMinigame(result) {
  const minigame = state.battle.minigame;
  state.battle.minigame = null;
  const events = [{ type: 'minigameScored', minigame, tier: result.tier, given: result.given, answer: state.battle.currentQuestion.meaning }];
  (result.missed || []).forEach((q) => {
    if (q !== state.battle.currentQuestion && recordHauntAnswer(q, false) === 'lingers') events.push({ type: 'hauntLingers' });
  });
  return events;
}

// ---- Close Enough: set a dial to a number answer ----

// The number Close Enough sets the dial to: a number question's answer
// above 0, with no unit or a plain one ("%", "B.C."), or null. "7½" and
// "13 and 14" don't fit a dial, and nor does a port (PORT_LIKE_TYPES): it
// names a service, so a near miss is no nearer to right.
function closeEnoughAnswer(q) {
  if (PORT_LIKE_TYPES.includes(q.answerType)) return null;
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

// ---- Fuel Mix: pour tanks until the engine holds the answer ----

// The whole number Fuel Mix fills to (a number answer Close Enough could
// dial, whole, at most FUEL_MIX.maxAnswer), or null.
function fuelMixAnswer(q) {
  const n = closeEnoughAnswer(q);
  if (!n || !Number.isInteger(n.value) || n.value > FUEL_MIX.maxAnswer) return null;
  return n.value;
}

// A new engine for question `q` (one Fuel Mix can run): `answer`, the
// `tanks` largest first (powers of ten up to the answer's, at least
// FUEL_MIX.minTanks of them), and `par` (the answer's digits added up:
// the fewest pours that can fill it).
export function fuelMixSetup(q) {
  const answer = fuelMixAnswer(q);
  const tanks = [];
  for (let size = 1; size <= answer || tanks.length < FUEL_MIX.minTanks; size *= 10) tanks.unshift(size);
  const par = String(answer).split('').reduce((sum, d) => sum + Number(d), 0);
  return { answer, tanks, par, total: 0, pours: 0, vents: 0 };
}

// Pours a tank of `size` into `engine` (fuelMixSetup's): 'under', 'match',
// or 'over' (the engine vents back to empty and counts a vent). The only
// nudge a pour gives is under or over (the light-nudge rule).
export function fuelMixPour(engine, size) {
  engine.pours++;
  engine.total += size;
  if (engine.total === engine.answer) return 'match';
  if (engine.total < engine.answer) return 'under';
  engine.total = 0;
  engine.vents++;
  return 'over';
}

// How many pours over par `engine` has used, vents counted at
// FUEL_MIX.ventCost each.
export function fuelMixOver(engine) {
  return engine.pours + engine.vents * FUEL_MIX.ventCost - engine.par;
}

// Whether `engine` has run dry: past the last tier's slack, a miss.
export function fuelMixDry(engine) {
  return fuelMixOver(engine) > FUEL_MIX.slack1;
}

// The tier of a filled engine: 'X' at par, '2' within FUEL_MIX.slack2
// pours over, '1' within slack1.
export function fuelMixTier(engine) {
  const over = fuelMixOver(engine);
  return over <= 0 ? 'X' : over <= FUEL_MIX.slack2 ? '2' : '1';
}

// ---- Scanner: pick where to look through the fog ----

// The fog's size: SCANNER.cols x rows, or the finer panic fog from panic
// level SCANNER.panicAt. `panic` is the crew's panic level.
export function scannerGrid(panic) {
  const fine = panic >= SCANNER.panicAt;
  return fine ? { cols: SCANNER.panicCols, rows: SCANNER.panicRows } : { cols: SCANNER.cols, rows: SCANNER.rows };
}

// The tier of a right answer after scanning `scanned` of `total` patches
// with `wrongs` wrong options first: by the share scanned (SCANNER.xShare,
// twoShare), one step down per wrong option. Null (a miss) past
// SCANNER.wrongsAllowed wrong.
export function scannerTier(scanned, total, wrongs) {
  if (wrongs > SCANNER.wrongsAllowed) return null;
  const share = scanned / total;
  const tiers = ['X', '2', '1'];
  const base = share <= SCANNER.xShare ? 0 : share <= SCANNER.twoShare ? 1 : 2;
  return tiers[Math.min(2, base + wrongs)];
}

// ---- Star Chart: join the answer's letters, star to star ----

// The word Star Chart spells, in capitals: one word of plain letters,
// STAR_CHART.minLetters to maxLetters long, or null.
function starChartWord(q) {
  const word = String(q.meaning || '').trim().toUpperCase();
  return /^[A-Z]+$/.test(word) && word.length >= STAR_CHART.minLetters && word.length <= STAR_CHART.maxLetters ? word : null;
}

// A new chart for question `q` (one Star Chart can run), at the crew's
// `panic` level: the `word`, its `stars` ({ letter, x, y } in percent of
// the sky, the word's letters and decoys that aren't in it, mixed and
// spread on a loose grid so none overlap), the `path` so far (star
// indexes) and the `out` stars (gone dark).
export function starChartSetup(q, panic = 0) {
  const word = starChartWord(q);
  const count = panic >= STAR_CHART.panicAt ? STAR_CHART.panicDecoys : STAR_CHART.decoys;
  const spare = shuffle([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(c => !word.includes(c))).slice(0, count);
  const letters = shuffle([...word, ...spare]);
  const cols = STAR_CHART.cols;
  const rows = Math.ceil(letters.length / cols);
  const cells = shuffle([...Array(cols * rows).keys()]);
  const stars = letters.map((letter, i) => ({
    letter,
    x: ((cells[i] % cols) + 0.5 + (Math.random() - 0.5) * 0.5) / cols * 100,
    y: (Math.floor(cells[i] / cols) + 0.5 + (Math.random() - 0.5) * 0.4) / rows * 100,
  }));
  return { word, stars, path: [], out: new Set(), wrong: 0 };
}

// Star `i` picked on `chart`: 'next' (the word's next letter, joined),
// 'done' (the last one), 'wrong' (goes dark for good: the only nudge is
// "not this star") or 'used' (dark or joined already; nothing happens).
export function starChartPick(chart, i) {
  if (chart.out.has(i) || chart.path.includes(i)) return 'used';
  if (chart.stars[i].letter !== chart.word[chart.path.length]) {
    chart.out.add(i);
    chart.wrong++;
    return 'wrong';
  }
  chart.path.push(i);
  return chart.path.length === chart.word.length ? 'done' : 'next';
}

// The tier for a chart finished with `wrong` wrong stars, or null (a miss)
// past STAR_CHART.maxWrong.
export function starChartTier(wrong) {
  if (wrong > STAR_CHART.maxWrong) return null;
  return wrong === 0 ? 'X' : wrong <= STAR_CHART.wrong2 ? '2' : '1';
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

// A new spelling for question `q` (one Slow Spell can run): its `chars`,
// the letter places in the order they fill in (`order`, a hyphen or
// apostrophe shows from the start), the letter count (`total`), how many
// fill in before the letters stop on their own (`stopAt`: all but one,
// so the answer is never simply read off). The answer is typed, not
// picked (Timothy, 2026-10-11: options gave it away).
export function slowSpellWord(q) {
  const chars = [...q.meaning.trim()];
  const places = chars.map((c, i) => i).filter(i => /\p{L}/u.test(chars[i]));
  return {
    chars,
    order: shuffle(places),
    total: places.length,
    stopAt: places.length - 1,
  };
}

// Whether `typed` spells Slow Spell's answer `word`: case and extra spaces
// don't count, the same as a typed answer anywhere in the game.
export function slowSpellMatches(word, typed) {
  return normalizeSpaces(typed).toLowerCase() === normalizeSpaces(word.chars.join('')).toLowerCase();
}

// The tier for an answer given with `shown` of `total` letters filled
// in: 'X' for at most SLOW_SPELL_X_SHOWN, '2' for at most half, else '1'.
// A wrong answer is a miss whatever was shown.
export function slowSpellTier(shown, total) {
  if (shown <= SLOW_SPELL_X_SHOWN) return 'X';
  return shown <= Math.floor(total / 2) ? '2' : '1';
}

// ---- Syllable Split: build a name from its pieces ----

// Vowels a name splits on. Y is one too, except first or before a vowel.
const VOWELS = 'aeiou';
// Consonant pairs kept together, starting the next piece ("Ne-bu-chad").
const DIGRAPHS = ['ch', 'sh', 'th', 'ph', 'wh', 'gh', 'ck'];
// Consonant pairs that can start a piece ("A-bra-ham", not "Ab-ra-ham").
const ONSETS = ['br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'bl', 'cl', 'fl', 'gl', 'pl'];

// Names already split. DEV -> Minigame checks every question of a set,
// each against every name, so a split is worked out once.
const splits = new Map();

// `word` cut into rough syllables on its vowel groups: one consonant
// between two goes with the next piece, two or more are split after the
// first, keeping a digraph or a starting pair together; a silent final
// "e" stays on the last piece. Rough on purpose: a question's own
// `syllables` field fixes a bad split by hand.
export function splitSyllables(word) {
  if (!splits.has(word)) splits.set(word, cutSyllables(word));
  return splits.get(word);
}

// splitSyllables' work, uncached.
function cutSyllables(word) {
  const w = word.toLowerCase();
  const vowel = i => VOWELS.includes(w[i]) || (w[i] === 'y' && i > 0 && !VOWELS.includes(w[i + 1] || ''));
  const groups = [];
  for (let i = 0; i < w.length; i++) {
    if (!vowel(i)) continue;
    const start = i;
    while (i + 1 < w.length && vowel(i + 1)) i++;
    groups.push([start, i + 1]);
  }
  const last = groups[groups.length - 1];
  if (groups.length > 1 && w.endsWith('e') && last[0] === w.length - 1 && last[0] - groups[groups.length - 2][1] === 1) groups.pop();
  const cuts = [];
  for (let g = 0; g < groups.length - 1; g++) {
    const a = groups[g][1];
    const b = groups[g + 1][0];
    if (b - a <= 1) cuts.push(a);
    else if (DIGRAPHS.includes(w.slice(b - 2, b)) || (b - a === 2 && ONSETS.includes(w.slice(a, b)))) cuts.push(b - 2);
    else if (DIGRAPHS.includes(w.slice(a, a + 2))) cuts.push(a + 2);
    else cuts.push(a + 1);
  }
  return [0, ...cuts].map((at, i) => word.slice(at, cuts[i] ?? word.length));
}

// Question `q`'s answer in pieces: its `syllables` field ("Ne-bu-chad" or
// a list) when that spells the answer, else splitSyllables(), or null when
// it can't run Syllable Split: not a name, not one word of letters, or
// fewer than SYLLABLE_SPLIT_MIN_PIECES pieces.
export function syllableSplitPieces(q) {
  if (!q || q.answerType !== 'name') return null;
  const answer = String(q.meaning || '').trim();
  if (!/^\p{L}+$/u.test(answer)) return null;
  const own = typeof q.syllables === 'string' ? q.syllables.split('-') : q.syllables;
  const fits = Array.isArray(own) && own.join('').toLowerCase() === answer.toLowerCase();
  const pieces = fits ? own.map(String) : splitSyllables(answer);
  return pieces.length >= SYLLABLE_SPLIT_MIN_PIECES ? pieces : null;
}

// The pieces of the set's other one-word names of two pieces or more
// (each spelling once), none of them a piece of `pieces`: the tray's decoys. Pieces
// of every length are kept, so a decoy can sit in any place.
function pieceDecoys(pieces) {
  const own = new Set(pieces.map(p => p.toLowerCase()));
  const answer = pieces.join('').toLowerCase();
  const seen = new Set();
  const decoys = [];
  for (const d of state.settings.activeData) {
    if (d.answerType !== 'name' || !/^\p{L}+$/u.test(String(d.meaning).trim())) continue;
    if (d.meaning.trim().toLowerCase() === answer) continue;
    const split = splitSyllables(d.meaning.trim());
    // A name of one piece ("Noah") is a whole name, plainly no piece.
    if (split.length < 2) continue;
    for (const piece of split) {
      const k = piece.toLowerCase();
      if (own.has(k) || seen.has(k)) continue;
      seen.add(k);
      decoys.push(piece);
    }
  }
  return decoys;
}

// A new tray for question `q` (one Syllable Split can run): the answer's
// `pieces` in order, and `tray`, those pieces and SYLLABLE_SPLIT_DECOYS
// decoys from other names, shuffled.
export function syllableSplitTray(q) {
  const pieces = syllableSplitPieces(q);
  const decoys = shuffle(pieceDecoys(pieces)).slice(0, SYLLABLE_SPLIT_DECOYS);
  return { pieces, tray: shuffle([...pieces, ...decoys]) };
}

// The tier for a name built with `wrong` wrong picks:
// SYLLABLE_SPLIT_TIERS[wrong], or null (a miss) past the last.
export function syllableSplitTier(wrong) {
  return SYLLABLE_SPLIT_TIERS[wrong] || null;
}

// ---- Letter Pool: spell a category's answers from a tray of letters ----

// The answers Letter Pool counts in category `group`: one word of
// LETTER_POOL_MIN_LETTERS to _MAX_LETTERS letters, each spelling once,
// in capitals.
function poolWords(group) {
  const words = new Set();
  for (const d of group.pool) {
    const word = String(d.meaning || '').trim().toUpperCase();
    if (/^\p{L}+$/u.test(word) && word.length >= LETTER_POOL_MIN_LETTERS && word.length <= LETTER_POOL_MAX_LETTERS) words.add(word);
  }
  return [...words];
}

// Whether category `group` can run as a Letter Pool: it has a label to
// name it by and at least LETTER_POOL_FORM + 1 answers to hide.
export function letterPoolFits(group) {
  return Boolean(group && group.label && group.pool) && poolWords(group).length > LETTER_POOL_FORM;
}

// A new Letter Pool for category `group`: `hidden`, LETTER_POOL_FORM + 1
// of its answers, picked to share letters (each next one adds the fewest
// new ones), so the tray stays small; `tiles`, their letters, each once,
// shuffled; `words`, every answer of the category the tiles can spell
// (the hidden ones among them); `label`, the category's name.
export function letterPoolSetup(group) {
  const left = shuffle(poolWords(group));
  const hidden = [left.pop()];
  const letters = new Set(hidden[0]);
  while (hidden.length <= LETTER_POOL_FORM) {
    const newLetters = w => [...new Set(w)].filter(c => !letters.has(c)).length;
    const best = left.reduce((a, b) => (newLetters(b) < newLetters(a) ? b : a));
    left.splice(left.indexOf(best), 1);
    hidden.push(best);
    for (const c of best) letters.add(c);
  }
  const words = poolWords(group).filter(w => [...w].every(c => letters.has(c)));
  return { label: group.label, hidden, tiles: shuffle([...letters]), words };
}

// What a word spelled in `pool` is: 'hidden' (one of the hidden answers),
// 'valid' (another answer of the category), or 'unknown'.
export function letterPoolCheck(pool, word) {
  const w = word.toUpperCase();
  if (pool.hidden.includes(w)) return 'hidden';
  return pool.words.includes(w) ? 'valid' : 'unknown';
}

// The tier for `formed` answers spelled, `hiddenFound` of them hidden:
// 'X' with every hidden one, '2' at LETTER_POOL_FORM, '1' at
// LETTER_POOL_WEAK, else null (a miss).
export function letterPoolTier(pool, formed, hiddenFound) {
  if (hiddenFound >= pool.hidden.length) return 'X';
  if (formed >= LETTER_POOL_FORM) return '2';
  return formed >= LETTER_POOL_WEAK ? '1' : null;
}

// ---- Code Break: crack the answer as a code, marked after each guess ----

// The code Code Break hides for question `q`: its answer's characters
// (codeChars), or null when it doesn't fit: not one word, the wrong
// length, or a number answer (Close Enough and Higher / Lower do those).
function codeBreakCode(q) {
  if (q.answerType === 'number') return null;
  const answer = String(q.meaning || '').trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N}'-]*$/u.test(answer)) return null;
  const code = codeChars(answer);
  return code.length >= CODE_BREAK_MIN_CHARS && code.length <= CODE_BREAK_MAX_CHARS ? code : null;
}

// `text` as code characters: its letters and digits, in capitals, so
// case, spaces and a hyphen never count ("wi-fi" is WIFI).
export function codeChars(text) {
  return [...String(text || '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '')];
}

// A new code for question `q` (one Code Break can run): its characters,
// and whether it is all digits (a port: the view offers a number pad).
export function codeBreakSetup(q) {
  const code = codeBreakCode(q);
  return { code, digits: code.every(c => /\p{N}/u.test(c)) };
}

// The marks for guess `typed` against `setup`'s code, one per character:
// 'hit' (right place), 'near' (in the code, elsewhere) or 'miss'. A
// character only counts as often as the code holds it, right places
// first, so guessing AAAA against AXAY marks hit, miss, hit, miss. Null
// when the guess isn't the code's length (not a guess).
export function codeBreakMarks(setup, typed) {
  const guess = codeChars(typed);
  const { code } = setup;
  if (guess.length !== code.length) return null;
  const marks = guess.map((c, i) => (c === code[i] ? 'hit' : 'miss'));
  const spare = {};
  code.forEach((c, i) => { if (marks[i] !== 'hit') spare[c] = (spare[c] || 0) + 1; });
  guess.forEach((c, i) => {
    if (marks[i] === 'hit' || !spare[c]) return;
    marks[i] = 'near';
    spare[c]--;
  });
  return marks;
}

// The tier for cracking the code on guess `n` (1-based): CODE_BREAK_TIERS.
export function codeBreakTier(n) {
  return CODE_BREAK_TIERS[n - 1] || null;
}

// ---- Verdict: call claims TRUE or FALSE ----

// What Verdict needs from the set loaded, worked out once per set: the
// answers of each answerType (each spelling once), and the questions it
// fits. Rebuilt when another set is loaded.
let verdictCache = { data: null, byType: null, fitting: null };

// verdictCache for state.settings.activeData.
function verdictIndex() {
  const data = state.settings.activeData || [];
  if (verdictCache.data === data) return verdictCache;
  const byType = new Map();
  data.forEach((q) => {
    if (!q.answerType) return;
    const answers = byType.get(q.answerType) || new Map();
    answers.set(normalizeSpaces(q.meaning).toLowerCase(), q.meaning);
    byType.set(q.answerType, answers);
  });
  // Cached before the fit check, which reads the answers back from it.
  verdictCache = { data, byType, fitting: [] };
  verdictCache.fitting = data.filter(verdictFits);
  return verdictCache;
}

// The other answers of question `q`'s answerType in the set: what a false
// claim can show.
function verdictDecoys(q) {
  const answers = verdictIndex().byType.get(q.answerType);
  if (!answers) return [];
  const own = normalizeSpaces(q.meaning).toLowerCase();
  return [...answers].filter(([key]) => key !== own).map(([, answer]) => answer);
}

// Whether question `q` can be a claim: it has an answerType with
// VERDICT_MIN_DECOYS other answers, no image (a claim shows words only),
// and its wording doesn't hold its answer (a true claim would be free).
function verdictFits(q) {
  return Boolean(q.answerType) && !q.image && !q.letterPool && !answerInStem(q) && verdictDecoys(q).length >= VERDICT_MIN_DECOYS;
}

// How many claims the Verdict showing asks: VERDICT_BOSS_CLAIMS against
// the boss, and only there; VERDICT_CLAIMS anywhere else.
export function verdictClaimCount() {
  const target = state.battle.selectedTarget;
  return target && target.kind === 'boss' ? VERDICT_BOSS_CLAIMS : VERDICT_CLAIMS;
}

// New claims for question `q` (one Verdict can run): `count` of them in a
// random order, `q` among them, the rest other questions it fits. Each is
// { q, shown, truth }: the answer shown, and whether it is the real one.
export function verdictSetup(q, count = verdictClaimCount()) {
  const others = shuffle(verdictIndex().fitting.filter(o => o !== q)).slice(0, count - 1);
  return shuffle([q, ...others]).map((claim) => {
    if (Math.random() >= VERDICT_FALSE_SHARE) return { q: claim, shown: claim.meaning, truth: true };
    const decoys = verdictDecoys(claim);
    return { q: claim, shown: decoys[Math.floor(Math.random() * decoys.length)], truth: false };
  });
}

// The tier for `wrong` wrong calls out of `count` claims: VERDICT_TIERS,
// or VERDICT_BOSS_TIERS for the boss's longer run; past the end, null.
export function verdictTier(wrong, count) {
  const tiers = count === VERDICT_BOSS_CLAIMS ? VERDICT_BOSS_TIERS : VERDICT_TIERS;
  return tiers[wrong] || null;
}

// ---- Crosswire: two answers cross on a shared letter ----

// Question `q`'s answer as Crosswire letters (one word of letters only,
// in capitals), or null when it can't be a word in the grid. A picture
// question can't: its clue would show without its picture.
function crosswireWord(q) {
  if (q.image) return null;
  const answer = String(q.meaning || '').trim();
  if (!/^\p{L}+$/u.test(answer)) return null;
  const word = [...answer.toUpperCase()];
  return word.length >= CROSSWIRE_MIN_LETTERS && word.length <= CROSSWIRE_MAX_LETTERS ? word : null;
}

// The set's questions that can be a Crosswire word, worked out once per
// set: each with its word and the letters it can cross on (all but its
// first). Rebuilt when another set is loaded.
let crosswireCache = { data: null, words: [] };

// crosswireCache for state.settings.activeData.
function crosswireWords() {
  const data = state.settings.activeData || [];
  if (crosswireCache.data === data) return crosswireCache.words;
  const words = [];
  data.forEach((q) => {
    const word = crosswireWord(q);
    if (word && !answerInStem(q)) words.push({ q, word, inner: new Set(word.slice(1)) });
  });
  crosswireCache = { data, words };
  return words;
}

// The words question `q` can cross: another answer that shares a letter
// with it, neither being its word's first letter. None when `q` can't be
// a word itself.
function crosswirePartners(q) {
  const word = crosswireWord(q);
  if (!word || answerInStem(q)) return [];
  const own = word.join('');
  const inner = word.slice(1);
  return crosswireWords().filter(w => w.q !== q && w.word.join('') !== own && inner.some(letter => w.inner.has(letter)));
}

// A new grid for question `q` (one Crosswire can run): `across` is `q`,
// `down` a partner, each { q, word }; they cross at `at`: letter
// at.across of the across word is letter at.down of the down word.
export function crosswireSetup(q) {
  const partners = crosswirePartners(q);
  const partner = partners[Math.floor(Math.random() * partners.length)];
  const word = crosswireWord(q);
  const crossings = [];
  word.forEach((letter, i) => {
    partner.word.forEach((other, j) => { if (i > 0 && j > 0 && letter === other) crossings.push({ across: i, down: j }); });
  });
  return {
    across: { q, word },
    down: { q: partner.q, word: partner.word },
    at: crossings[Math.floor(Math.random() * crossings.length)],
  };
}

// The tier for a checked grid: both words right pays CROSSWIRE_TIERS by
// the squares revealed (more than it lists pay its last), one word '1',
// neither null (a miss).
export function crosswireTier(acrossRight, downRight, reveals) {
  if (acrossRight && downRight) return CROSSWIRE_TIERS[Math.min(reveals, CROSSWIRE_TIERS.length - 1)];
  return acrossRight || downRight ? '1' : null;
}

// ---- Fog Reveal: name a picture as the fog lifts off it ----

// The tier for an answer given with `covered` tiles still over the
// picture: FOG_REVEAL_X_COVERED or more = 'X', FOG_REVEAL_2_COVERED or
// more = '2', fewer '1'. A wrong pick is a miss however early.
export function fogRevealTier(covered) {
  if (covered >= FOG_REVEAL_X_COVERED) return 'X';
  return covered >= FOG_REVEAL_2_COVERED ? '2' : '1';
}

// ---- Sum Lock: a trapped box takes the total of two number answers ----

// The set's questions a Sum Lock can add: a whole-number answer of 1 to
// SUM_LOCK_MAX_ADDEND that a dial could take (no port, no "7½"), no
// picture, not holding its answer. Worked out once per set.
let sumLockCache = { data: null, questions: [] };

// sumLockCache's questions for state.settings.activeData.
export function sumLockQuestions() {
  const data = state.settings.activeData || [];
  if (sumLockCache.data === data) return sumLockCache.questions;
  const questions = data.filter((q) => {
    const n = closeEnoughAnswer(q);
    return n && !n.unit && Number.isInteger(n.value) && n.value <= SUM_LOCK_MAX_ADDEND && !q.image && !answerInStem(q);
  });
  sumLockCache = { data, questions };
  return questions;
}

// Whether the target is a trapped box and the set has two questions to
// add: Sum Lock can run in place of its question.
function sumLockFits() {
  const target = state.battle.selectedTarget;
  return Boolean(target && target.kind === 'box' && target.trapped) && sumLockQuestions().length >= 2;
}

// A new lock: two different questions to add (`first`, `second`), their
// answers (`a`, `b`) and the `total` it opens on.
export function sumLockSetup() {
  const [first, second] = shuffle(sumLockQuestions()).slice(0, 2);
  const a = closeEnoughAnswer(first).value;
  const b = closeEnoughAnswer(second).value;
  return { first, second, a, b, total: a + b };
}

// Whether `typed` is the lock's total: digits only count, so " 47 " and
// "4,7" are 47; anything without a digit is no answer (null).
export function sumLockMatches(lock, typed) {
  const digits = String(typed || '').replace(/\D/g, '');
  return digits ? Number(digits) === lock.total : null;
}
