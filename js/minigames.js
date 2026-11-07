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
// rules (answers.js, gun.js) take the tier and pay it
// (MINIGAME_TIER_PAY in config.js).

import { state } from './state.js';
import {
  MINIGAME_CHANCE, CLOSE_ENOUGH_REACH_MIN, CLOSE_ENOUGH_REACH_MAX, CLOSE_ENOUGH_MIN_TOP, CLOSE_ENOUGH_MIN_STEPS,
  CLOSE_ENOUGH_BANDS, CLOSE_ENOUGH_SMALL, CLOSE_ENOUGH_SMALL_OFF,
  HIGHER_LOWER_REACH_MIN, HIGHER_LOWER_REACH_MAX, HIGHER_LOWER_MIN_TOP, HIGHER_LOWER_MIN_STEPS, HIGHER_LOWER_MAX_AT,
  PORT_LIKE_TYPES, HIGHER_LOWER_TIERS, FUEL_MIX, SCANNER, STAR_CHART, HULL_PATCH, INFERENCE, PATCH_BAY, ASTEROIDS, MATCH_BOSS, SLOW_SPELL_MIN_LETTERS, SLOW_SPELL_MAX_LETTERS, SLOW_SPELL_X_SHOWN,
  SYLLABLE_SPLIT_MIN_PIECES, SYLLABLE_SPLIT_DECOYS, SYLLABLE_SPLIT_TIERS,
  CODE_BREAK_MIN_CHARS, CODE_BREAK_MAX_CHARS, CODE_BREAK_TIERS,
  VERDICT_CLAIMS, VERDICT_BOSS_CLAIMS, VERDICT_TIERS, VERDICT_BOSS_TIERS, VERDICT_FALSE_SHARE, VERDICT_MIN_DECOYS,
  CROSSWIRE_MIN_LETTERS, CROSSWIRE_MAX_LETTERS, CROSSWIRE_TIERS, FOG_REVEAL_X_COVERED, FOG_REVEAL_2_COVERED,
  SUM_LOCK_MAX_ADDEND,
  LETTER_POOL_FORM, LETTER_POOL_WEAK, LETTER_POOL_MIN_LETTERS, LETTER_POOL_MAX_LETTERS, SHIP_JOB, BATTLE_CHOICE_COUNT,
} from './config.js';
import { numberQuestion, pickQuestion, normalizeSpaces, fightGroups, rightAnswers } from './quiz.js';
import { shuffle } from './random.js';
import { ZODIAC } from './zodiac.js';
import { MINIGAME_LEVELS } from './config.js';
import { t } from './text.js';

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
  hullPatch: [],
  inference: [],
  patchBay: [],
  asteroids: [],
  // The final boss: run by its own stand-in question only (bossQuestion).
  match: [],
};

// Minigames only the ship's crew roles run (ship minigames plan): never
// rolled in place of a question elsewhere.
export const SHIP_ONLY = ['fuelMix', 'scanner', 'starChart', 'hullPatch', 'inference', 'patchBay', 'asteroids', 'match'];

export const MINIGAMES = Object.keys(MINIGAME_MODIFIERS);

// Whether each minigame can run a question.
const FITS = {
  closeEnough: q => closeEnoughAnswer(q) !== null,
  higherLower: q => higherLowerAnswer(q) !== null,
  slowSpell: q => spellable(q.answer) && !answerInStem(q),
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
  hullPatch: q => hullPatchWord(q) !== null && !answerInStem(q),
  // Inference runs a fact of the set's facts list, not a question: only
  // its own stand-in question (inferenceQuestion) fits it.
  inference: q => Boolean(q.inference),
  // Patch Bay runs a board of the set's facts, not a question: only its
  // own stand-in question (patchBayQuestion) fits it.
  patchBay: q => Boolean(q.patchBay),
  asteroids: q => asteroidsFits(q),
  match: q => Boolean(q.match),
};

// An open-list question (factgen.js: its facts may not hold every right
// answer) fits no minigame: each one either wants one exact answer typed
// or built (Slow Spell, Crosswire ...) or shows decoys from the whole set
// (Verdict, Asteroids), which could be a right answer the facts left out.
// It is asked as plain multiple choice only.
Object.keys(FITS).forEach((id) => {
  const fits = FITS[id];
  FITS[id] = q => !q.openList && fits(q);
});

// Whether question `q`'s wording holds its own answer ("Spell
// Bartimaeus."): a minigame that spells the answer out would be free.
function answerInStem(q) {
  return String(q.question || '').toLowerCase().includes(String(q.answer || '').trim().toLowerCase());
}

// Whether `minigame` can be a ship crew role's job on the loaded set (crew
// roles plan; roles.js): Letter Pool needs a category it can run, Sum Lock
// two number answers to add, Patch Bay a predicate that makes a board,
// any other enough questions it fits
// (SHIP_JOB.minFitting). One that can't, its role sits out the run.
export function roleCanRun(minigame) {
  const data = state.settings.activeData || [];
  if (minigame === 'letterPool') return roleGroups().length > 0;
  if (minigame === 'sumLock') return sumLockQuestions().length >= 2;
  if (minigame === 'inference') return inferenceTargets().length >= SHIP_JOB.minFitting;
  if (minigame === 'patchBay') return patchBayPredicates().length > 0;
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

// rollMinigame's choice, without recording it. Never the same one twice
// in a row.
function pickMinigame(q, offered, group) {
  const mode = state.settings.minigame;
  if (mode === 'off') return null;
  // DEV -> Minigame may force a ship-only one; a roll never picks one.
  const ids = minigamesFor(q).filter(id => mode !== 'roll' || !SHIP_ONLY.includes(id));
  if (letterPoolFits(group)) ids.push('letterPool');
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
  if (mode === 'inference') return inferenceTargets().length ? inferenceQuestion(q) : q;
  if (mode === 'patchBay') return patchBayPredicates().length ? patchBayQuestion(q) : q;
  const inPool = (pool || []).filter(FITS[mode]);
  const fitting = inPool.length ? inPool : state.settings.activeData.filter(FITS[mode]);
  return fitting.length ? pickQuestion(q, fitting) : q;
}

// ---- Levels: each game harder with every perfect solve ----

// The best tier minigame `id` can give (a perfect solve): X, or the first
// of Syllable Split's tiers (it has no X).
export function bestTier(id) {
  return id === 'syllableSplit' ? SYLLABLE_SPLIT_TIERS[0] : 'X';
}

// Minigame `id`'s level this run: its perfect solves on the ship, up to
// its last level. 0 off the ship or for a game with no levels. Panic
// plays no part (Timothy 2026-11-01: panic only ends the run).
export function minigameLevel(id) {
  const levels = MINIGAME_LEVELS.games[id];
  if (!levels) return 0;
  const perfect = (state.run.ship && state.run.ship.perfect && state.run.ship.perfect[id]) || 0;
  return Math.min(levels.length - 1, perfect);
}

// Minigame `id`'s settings at its level now (minigameLevel).
export function levelOf(id) {
  return MINIGAME_LEVELS.games[id][minigameLevel(id)];
}

// The minigame showing has ended with `result`. Clears
// state.battle.minigame. A minigame that asked more questions than the
// one showing (Verdict) lists the ones missed in `result.missed`; they no
// longer become haunts (haunts are dungeon-only, never asked on the ship;
// dungeon removal plan step A).
// Events: minigameScored { minigame, tier, given, answer }.
export function endMinigame(result) {
  const minigame = state.battle.minigame;
  state.battle.minigame = null;
  // A perfect solve on the ship: that game gets harder (its level).
  if (state.run.ship && result.right && result.tier === bestTier(minigame)) {
    state.run.ship.perfect = state.run.ship.perfect || {};
    state.run.ship.perfect[minigame] = (state.run.ship.perfect[minigame] || 0) + 1;
  }
  return [{ type: 'minigameScored', minigame, tier: result.tier, given: result.given, answer: state.battle.currentQuestion.answer }];
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
// FUEL_MIX.minTanks of them, and the FUEL_MIX.extraTanks between them),
// and `par` (the fewest pours that can fill it: the biggest tank that
// still fits, again and again).
export function fuelMixSetup(q) {
  const answer = fuelMixAnswer(q);
  const tens = [];
  for (let size = 1; size <= answer || tens.length < FUEL_MIX.minTanks; size *= 10) tens.push(size);
  const tanks = [...tens, ...FUEL_MIX.extraTanks].sort((a, b) => b - a);
  let left = answer;
  let par = 0;
  tanks.forEach((size) => { par += Math.floor(left / size); left %= size; });
  const { slack2, slack1, hideTotal } = levelOf('fuelMix');
  return { answer, tanks, par, total: 0, pours: 0, vents: 0, slack2, slack1, hideTotal };
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
function fuelMixOver(engine) {
  return engine.pours + engine.vents * FUEL_MIX.ventCost - engine.par;
}

// Whether `engine` has run dry: past the last tier's slack, a miss.
export function fuelMixDry(engine) {
  return fuelMixOver(engine) > engine.slack1;
}

// The tier of a filled engine: 'X' at par, '2' within its slack2
// pours over, '1' within slack1.
export function fuelMixTier(engine) {
  const over = fuelMixOver(engine);
  return over <= 0 ? 'X' : over <= engine.slack2 ? '2' : '1';
}

// ---- Scanner: pick where to look through the fog ----

// The fog's size, { cols, rows }, at Scanner's level (finer as the
// player gets good at it).
export function scannerGrid() {
  const { cols, rows } = levelOf('scanner');
  return { cols, rows };
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
  const word = String(q.answer || '').trim().toUpperCase();
  return /^[A-Z]+$/.test(word) && word.length >= STAR_CHART.minLetters && word.length <= STAR_CHART.maxLetters ? word : null;
}

// A new chart for question `q` (one Star Chart can run), at its level:
// the `word`, its `stars` ({ letter, x, y } in percent of
// the sky, the word's letters and decoys that aren't in it, mixed and
// spread on a loose grid so none overlap), the `path` so far (star
// indexes) and the `out` stars (gone dark).
export function starChartSetup(q) {
  const word = starChartWord(q);
  const count = levelOf('starChart').decoys;
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

// ---- Hull Patch: plate the hole the answer's letters make ----

// The word Hull Patch's hole spells, in capitals: one word of plain
// letters, HULL_PATCH.minLetters to maxLetters long, or null.
function hullPatchWord(q) {
  const word = String(q.answer || '').trim().toUpperCase();
  return /^[A-Z]+$/.test(word) && word.length >= HULL_PATCH.minLetters && word.length <= HULL_PATCH.maxLetters ? word : null;
}

// A new hull for question `q` (one Hull Patch can run), at its level:
// the `word`, the `tray` (its letters once each and
// the level's decoy letters not in it, mixed), the letters `placed` and
// fallen `off`, the `strain` so far and the `max` the hull holds.
export function hullPatchSetup(q) {
  const word = hullPatchWord(q);
  const own = [...new Set(word)];
  const { decoys, maxStrain: max } = levelOf('hullPatch');
  const spare = shuffle([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(c => !word.includes(c))).slice(0, decoys);
  return { word, tray: shuffle([...own, ...spare]), placed: new Set(), off: new Set(), strain: 0, max };
}

// Plate `letter` tried on `hull`: 'fits' (in the word: fills every spot it
// belongs in), 'sealed' (that was the last one), 'off' (not in the word:
// it falls off and the hull strains; the only nudge is "not this
// letter"), 'breach' (that strain was one too many) or 'used' (tried
// already; nothing happens).
export function hullPatchPlate(hull, letter) {
  if (hull.placed.has(letter) || hull.off.has(letter)) return 'used';
  if (!hull.word.includes(letter)) {
    hull.off.add(letter);
    hull.strain++;
    return hull.strain >= hull.max ? 'breach' : 'off';
  }
  hull.placed.add(letter);
  return [...hull.word].every(c => hull.placed.has(c)) ? 'sealed' : 'fits';
}

// The tier of a sealed hull by its `strain`: 0 = X, up to
// HULL_PATCH.strain2 = 2, more = 1.
export function hullPatchTier(strain) {
  return strain === 0 ? 'X' : strain <= HULL_PATCH.strain2 ? '2' : '1';
}

// ---- Inference: work a fact out from lines that add up ----
// Inference reads the set's facts list (state.settings.activeFacts,
// lists/facts/<id>.json; facts list plan step B), not its questions: only
// facts with a whole-number value of at least 1.

// The set's facts Inference can use: { fact, value, source? } with a
// whole-number value of at least 1.
export function inferenceFacts() {
  return (state.settings.activeFacts || []).filter(f => Number.isInteger(f.value) && f.value >= 1);
}

// The facts that can help work out fact `target`: other facts, with a
// different name and value from it.
function inferenceHelpers(target) {
  return inferenceFacts().filter(f => f !== target && f.fact !== target.fact && f.value !== target.value);
}

// The facts Inference can ask for: ones with at least two others to help.
// None (a set with no facts file, or too few number facts): the Science Officer
// sits out (roleCanRun).
export function inferenceTargets() {
  return inferenceFacts().filter(f => inferenceHelpers(f).length >= 2);
}

// Inference's stand-in for a question: it asks for a fact Inference can
// run (never the one `exclude` asked, when there's another), and its
// answer is the fact's value, for the log on a miss.
export function inferenceQuestion(exclude = null) {
  const targets = inferenceTargets();
  const last = exclude && exclude.inference && exclude.inference.fact;
  const fresh = targets.length > 1 ? targets.filter(f => f.fact !== last) : targets;
  const fact = fresh[Math.floor(Math.random() * fresh.length)];
  return {
    question: t('mg.inference.term', { fact: fact.fact }),
    answer: String(fact.value),
    ...(fact.source ? { source: fact.source } : {}),
    inference: fact,
  };
}

// The puzzle level for this run: Inference's perfect solves on the ship
// (solved on the first CHECK), a level every INFERENCE.solvesPerLevel, up
// to the last of INFERENCE.levels; 0 off the ship.
export function inferenceLevel() {
  const perfect = (state.run.ship && state.run.ship.perfect && state.run.ship.perfect.inference) || 0;
  return Math.min(INFERENCE.levels.length - 1, Math.floor(perfect / INFERENCE.solvesPerLevel));
}

// A new puzzle for fact `target` (one of inferenceTargets), at `level` (an
// index into INFERENCE.levels: how many facts, which operations, whether
// a line can hold three symbols): `facts`, by id ('A', 'B', 'C' help, 'T'
// is the one asked for), each { fact, value, sign (its ZODIAC index, a
// different one each) }, and `lines`, each { terms, total }. Terms are
// fact ids and '+', '-', 'x', '/' and '^2' (the symbol before it squared).
// Each line brings in one new fact beside ones already worked out (A on
// its own first, T last), so working down the lines there is always
// exactly one answer. A fact goes into a line only where the numbers
// allow (a whole division, a total no bigger than INFERENCE.maxTotal), so
// a level whose sums the set's numbers can't make falls back to + and -.
export function inferenceSetup(target, level = inferenceLevel()) {
  const lv = INFERENCE.levels[Math.max(0, Math.min(level, INFERENCE.levels.length - 1))];
  const T = target;
  const pool = shuffle(inferenceHelpers(target));
  const helpers = [];
  pool.forEach((f) => { if (helpers.length < lv.facts - 1 && !helpers.some(h => h.value === f.value)) helpers.push(f); });
  const ids = ['A', 'B', 'C'].slice(0, helpers.length);
  const facts = {};
  ids.forEach((id, k) => { facts[id] = { fact: helpers[k].fact, value: helpers[k].value }; });
  facts.T = { fact: T.fact, value: T.value };
  const can = op => lv.ops.includes(op);
  const v = id => facts[id].value;
  const lines = [];
  [...ids, 'T'].forEach((id, k) => {
    const known = [...ids, 'T'].slice(0, k);
    const forms = inferenceForms(id, known, v, can, lv.three);
    // The harder forms first when there are any: the level's newest ops.
    const hard = forms.filter(f => f.hard);
    const pick = (hard.length && Math.random() < INFERENCE.hardShare ? hard : forms);
    const terms = pick[Math.floor(Math.random() * pick.length)].terms;
    lines.push({ terms, total: inferenceValue({ terms }, Object.fromEntries(Object.keys(facts).map(f => [f, v(f)]))) });
  });
  // Each fact gets its own zodiac sign (zodiac.js), drawn in its place.
  const signs = shuffle([...Array(ZODIAC.length).keys()]);
  Object.values(facts).forEach((f, k) => { f.sign = signs[k]; });
  return { level, facts, lines, checks: 0 };
}

// The lines that can bring in fact `id` (value by `v`) beside the facts
// already `known`, with the ops `can` allows: [{ terms, hard }]. Every
// form has `id` once (or twice on its own), so its value follows from the
// line. `three`: a line may add or take away one more known fact.
function inferenceForms(id, known, v, can, three) {
  const x = v(id);
  const max = INFERENCE.maxTotal;
  const forms = [];
  const add = (terms, hard = false) => forms.push({ terms, hard });
  if (!known.length) {
    add([id, '+', id]);
    if (can('x') && x * x <= max && x > 1) add([id, 'x', id], true);
    if (can('^') && x * x <= max && x > 1) add([id, '^2'], true);
    return forms;
  }
  known.forEach((k) => {
    const y = v(k);
    add([id, '+', k]);
    if (can('-')) add(x > y ? [id, '-', k] : [k, '-', id]);
    if (can('x') && y > 1 && x * y <= max) add([k, 'x', id], true);
    if (can('/') && y > 1 && x % y === 0 && x > y) add([id, '/', k], true);
    if (can('/') && x > 1 && y % x === 0 && y > x) add([k, '/', id], true);
    if (can('^') && y > 1 && y * y + x <= max) add([k, '^2', '+', id], true);
    if (can('^') && x > 1 && x * x + y <= max) add([id, '^2', '+', k], true);
  });
  if (three && known.length >= 2) {
    // One more known fact added or taken away, keeping the total at 0 or more.
    const base = forms.slice();
    base.forEach((f) => {
      known.forEach((k) => {
        if (f.terms.includes(k)) return;
        const with2 = [...f.terms, '+', k];
        add(with2, true);
        const without = [...f.terms, '-', k];
        if (inferenceValue({ terms: without }, Object.fromEntries([id, ...known].map(n => [n, v(n)]))) >= 0) add(without, true);
      });
    });
  }
  return forms;
}

// Line `line`'s value with `values` (fact id -> number): squares first,
// then x and /, then + and -, left to right.
export function inferenceValue(line, values) {
  const t = line.terms;
  let i = 0;
  const factor = () => {
    const id = t[i++];
    let n = values[id] !== undefined ? values[id] : Number(id);
    if (t[i] === '^2') { n *= n; i++; }
    return n;
  };
  const product = () => {
    let n = factor();
    while (t[i] === 'x' || t[i] === '/') n = t[i++] === 'x' ? n * factor() : n / factor();
    return n;
  };
  let total = product();
  while (t[i] === '+' || t[i] === '-') total = t[i++] === '+' ? total + product() : total - product();
  return total;
}

// A CHECK of `puzzle` with the player's `values` (every fact id, 'T' the
// answer): which lines hold (`holds`, one per line) and whether all do
// (`solved`, which can only happen with the right answer). Counts the
// CHECK.
export function inferenceCheck(puzzle, values) {
  puzzle.checks++;
  const holds = puzzle.lines.map(line => Math.abs(inferenceValue(line, values) - line.total) < 1e-9);
  // Every fact is a whole number of at least 1 (a square's root is never
  // the negative one), so only the true facts solve it.
  const whole = Object.values(values).every(n => Number.isInteger(n) && n >= 1);
  const solved = whole && holds.every(Boolean);
  return { holds, solved };
}

// The tier of a puzzle solved on CHECK `checks`: 1 = X, 2 = 2, up to
// INFERENCE.maxChecks = 1.
export function inferenceTier(checks) {
  return checks <= 1 ? 'X' : checks === 2 ? '2' : '1';
}

// ---- Patch Bay: cable each subject to its object ----
// The Signals officer's job (facts list plan step E; Timothy 2026-11-07).
// It reads the set's facts as triples (state.settings.activeTriples,
// factgen.js readTriples): one predicate per board, its subjects as plugs
// on the left, objects on the right. A board never lets one plug fit two:
// no subject and no object repeats, and no left plug has a fact of the
// predicate with another right plug (David married two of the wives:
// only one of them goes on a board with him).

// A fact side's key: an entity by id, a number by value.
function sideKey(side) {
  return typeof side === 'number' ? '#' + side : side.id;
}

// What a fact side shows: an entity's name (never its id), or the number.
function sideText(side) {
  return typeof side === 'number' ? String(side) : side.name;
}

// A plug's name as a key, so two plugs that read the same count as one.
function plugName(side) {
  return 'name:' + sideText(side).toLowerCase();
}

// A predicate as words: "father_of" -> "father of".
function predicateWords(predicate) {
  return predicate.replaceAll('_', ' ');
}

// The set's triples (none when a set has no facts file).
function triples() {
  return state.settings.activeTriples || { facts: [], labels: {} };
}

// The facts of the loaded set, grouped by predicate in file order:
// Map predicate -> facts.
function patchBayByPredicate() {
  const byPredicate = new Map();
  (triples().facts || []).forEach((f) => {
    if (!byPredicate.has(f.predicate)) byPredicate.set(f.predicate, []);
    byPredicate.get(f.predicate).push(f);
  });
  return byPredicate;
}

// Every "subject|object" key of `facts`.
function linkedPairs(facts) {
  return new Set(facts.map(f => sideKey(f.subject) + '|' + sideKey(f.object)));
}

// Up to `n` of `facts` (all of one predicate) that can share a board,
// taken in the order given: each new pair's subject and object are new to
// the board, and neither its subject has a fact with a board object nor a
// board subject with its object (`linked`: linkedPairs of the predicate).
// Plug names don't repeat either, so two plugs never read the same.
function cleanPairs(facts, n, linked) {
  const picked = [];
  const used = new Set();
  for (const f of facts) {
    if (picked.length >= n) break;
    const s = sideKey(f.subject);
    const o = sideKey(f.object);
    const names = ['L' + plugName(f.subject), 'R' + plugName(f.object)];
    if (used.has(s) || used.has(o) || names.some(k => used.has(k))) continue;
    if (picked.some(g => linked.has(s + '|' + sideKey(g.object)) || linked.has(sideKey(g.subject) + '|' + o))) continue;
    picked.push(f);
    [s, o, ...names].forEach(k => used.add(k));
  }
  return picked;
}

// The predicates of the loaded set a board can be made from: ones with
// PATCH_BAY.minCables clean pairs in file order (so the answer never
// changes with a shuffle). None: the Signals officer sits out.
export function patchBayPredicates() {
  const out = [];
  patchBayByPredicate().forEach((facts, predicate) => {
    if (cleanPairs(facts, Infinity, linkedPairs(facts)).length >= PATCH_BAY.minCables) out.push(predicate);
  });
  return out;
}

// A new board over `predicate` at `level` (MINIGAME_LEVELS.games.patchBay):
// the most clean pairs up to the level's cables, from file order and
// PATCH_BAY.tries shuffles (file order always gives at least minCables),
// plus, when the level has a spare and the predicate has one, a right plug
// with no partner: a real object of the predicate, not on the board, that
// no left plug has a fact with. Returns { predicate, words, left, right,
// pairs, locked, checks, level }: left plugs { id 'A'..., text, subject },
// right plugs { id 'r0'..., text, key } in shuffled order, `pairs` left
// id -> right id, `locked` the left ids cabled right so far.
export function patchBaySetup(predicate, level = minigameLevel('patchBay')) {
  const facts = patchBayByPredicate().get(predicate) || [];
  const linked = linkedPairs(facts);
  const { cables, spare } = MINIGAME_LEVELS.games.patchBay[level];
  let best = cleanPairs(facts, cables, linked);
  for (let i = 0; i < PATCH_BAY.tries && best.length < cables; i++) {
    const tried = cleanPairs(shuffle(facts.slice()), cables, linked);
    if (tried.length > best.length) best = tried;
  }
  best = shuffle(best.slice());
  const left = best.map((f, i) => ({ id: String.fromCharCode(65 + i), text: sideText(f.subject), subject: f.subject }));
  const right = best.map(f => ({ text: sideText(f.object), key: sideKey(f.object) }));
  if (spare) {
    const taken = new Set(best.flatMap(f => [sideKey(f.object), plugName(f.object)]));
    const free = facts.map(f => f.object).find(o => !taken.has(sideKey(o)) && !taken.has(plugName(o))
      && !best.some(f => linked.has(sideKey(f.subject) + '|' + sideKey(o))));
    if (free !== undefined) right.push({ text: sideText(free), key: sideKey(free) });
  }
  const order = shuffle(right.map((r, i) => i));
  const shown = order.map((i, n) => ({ ...right[i], id: 'r' + n }));
  const pairs = {};
  left.forEach((l, i) => { pairs[l.id] = shown[order.indexOf(i)].id; });
  return { predicate, words: predicateWords(predicate), left, right: shown, pairs, locked: {}, checks: 0, level };
}

// Patch Bay's stand-in for a question: a board over one of the set's
// predicates (never the one just asked when there is another; `exclude`
// is the last question). Its answer lists each pair, for the log on a miss.
export function patchBayQuestion(exclude = null) {
  const predicates = patchBayPredicates();
  const last = exclude && exclude.patchBay && exclude.patchBay.predicate;
  const fresh = predicates.length > 1 ? predicates.filter(p => p !== last) : predicates;
  const board = patchBaySetup(fresh[Math.floor(Math.random() * fresh.length)]);
  const textOf = id => board.right.find(r => r.id === id).text;
  return {
    question: t('mg.patchBay.term', { words: board.words }),
    answer: board.left.map(l => t('mg.patchBay.pair', { left: l.text, right: textOf(board.pairs[l.id]) })).join(', '),
    patchBay: board,
  };
}

// A CHECK of `board` with the player's `cables` (left id -> right id, every
// left plug cabled): right cables lock (`board.locked`), and each wrong one
// comes back with its nudge (patchBayNudge), for the view to drop it.
// Counts the CHECK. Returns { wrong: [{ left, right, nudge }], solved }.
export function patchBayCheck(board, cables) {
  board.checks++;
  const wrong = [];
  board.left.forEach((l) => {
    if (board.locked[l.id]) return;
    if (cables[l.id] === board.pairs[l.id]) board.locked[l.id] = true;
    else wrong.push({ left: l.id, right: cables[l.id], nudge: patchBayNudge(board, l.id, cables[l.id]) });
  });
  return { wrong, solved: wrong.length === 0 };
}

// The tier of a board solved on CHECK `checks`: 1 = X, 2 = 2, then 1.
export function patchBayTier(checks) {
  return checks <= 1 ? 'X' : checks === 2 ? '2' : '1';
}

// A fact as a line: its template's label filled in, then the other side
// ("Solomon's father: David", "RJ45 cable: twisted pair"), or, with no
// label naming just one side, "<subject> <predicate words> <object>".
function factLine(f) {
  const label = triples().labels[f.predicate];
  const s = sideText(f.subject);
  const o = sideText(f.object);
  const hasS = Boolean(label) && label.includes('{subject}');
  const hasO = Boolean(label) && label.includes('{object}');
  if (hasS && !hasO) return t('mg.patchBay.fact', { label: label.replaceAll('{subject}', s), value: o });
  if (hasO && !hasS) return t('mg.patchBay.fact', { label: label.replaceAll('{object}', o), value: s });
  return t('mg.patchBay.plain', { subject: s, words: predicateWords(f.predicate), object: o });
}

// The light nudge for a wrong cable from left plug `leftId` to right plug
// `rightId` (2026-11-01 light-nudge rule): a fact about that left plug's
// subject, on either side, of another predicate, that names no right plug
// on the board ("Boaz's wife: Ruth."). None: for numbers, whether its
// partner is higher or lower than the wrong plug; else that there is no
// other fact about it here. Never the answer.
export function patchBayNudge(board, leftId, rightId) {
  const l = board.left.find(p => p.id === leftId);
  const wrongPlug = board.right.find(p => p.id === rightId);
  const rightPlug = board.right.find(p => p.id === board.pairs[leftId]);
  const onBoard = new Set(board.right.flatMap(p => [p.key, 'name:' + p.text.toLowerCase()]));
  const named = side => onBoard.has(sideKey(side)) || onBoard.has(plugName(side));
  const me = sideKey(l.subject);
  const fact = (triples().facts || []).find((f) => {
    if (f.predicate === board.predicate) return false;
    if (sideKey(f.subject) === me) return !named(f.object);
    if (typeof f.object !== 'number' && sideKey(f.object) === me) return !named(f.subject);
    return false;
  });
  if (fact) return factLine(fact);
  if (wrongPlug && rightPlug.key[0] === '#' && wrongPlug.key[0] === '#') {
    return t(Number(rightPlug.text) > Number(wrongPlug.text) ? 'mg.patchBay.higher' : 'mg.patchBay.lower', { left: l.text, n: wrongPlug.text });
  }
  return t('mg.patchBay.noFact', { left: l.text });
}

// ---- Asteroids: shoot the rock that carries the answer ----

// Each answerType's answers short enough for a rock, with a question each
// answers: { key, text, asks }. Worked out once per set.
let asteroidsCache = { data: null, byType: new Map() };
function asteroidsIndex() {
  const data = state.settings.activeData || [];
  if (asteroidsCache.data === data) return asteroidsCache.byType;
  const byType = new Map();
  data.forEach((q) => {
    const text = normalizeSpaces(q.answer || '');
    if (!q.answerType || q.image || !text || text.length > ASTEROIDS.maxChars) return;
    const answers = byType.get(q.answerType) || new Map();
    const key = text.toLowerCase();
    if (!answers.has(key)) answers.set(key, { key, text, asks: q.question });
    byType.set(q.answerType, answers);
  });
  asteroidsCache = { data, byType };
  return byType;
}

// The decoys question `q` can fly with: the other short answers of its
// kind in the set, each with a question it answers. None is one of `q`'s
// own right answers (rightAnswers: any of David's sons).
function asteroidsDecoys(q) {
  const answers = asteroidsIndex().get(q.answerType);
  if (!answers) return [];
  const own = rightAnswers(q);
  return [...answers.values()].filter(a => !own.has(a.key));
}

// Whether Asteroids can run `q`: a short answer, no picture, the stem
// not holding it, and enough decoys of its kind for a field of rocks.
function asteroidsFits(q) {
  const text = normalizeSpaces(q.answer || '');
  return Boolean(text) && text.length <= ASTEROIDS.maxChars && !q.image && !answerInStem(q) && asteroidsDecoys(q).length >= ASTEROIDS.rocks - 1;
}

// A new field for question `q` (one Asteroids can run), at its level:
// `rocks` ({ text, right, asks }: the right answer and
// decoys, mixed; a decoy's `asks` is a question it is the answer to),
// largest field first (the view may fly fewer, always keeping the right
// one), and `shots` left.
export function asteroidsSetup(q) {
  const { rocks: count, shots } = levelOf('asteroids');
  const decoys = shuffle(asteroidsDecoys(q)).slice(0, count - 1).map(d => ({ text: d.text, right: false, asks: d.asks }));
  return { rocks: [{ text: normalizeSpaces(q.answer), right: true, asks: q.question }, ...decoys], shots, maxShots: shots };
}

// Rock `rock` of `field` was hit: 'right', 'wrong' (spends a shot; the
// view says what the rock is the answer to: the light nudge teaches a
// second fact without pointing at the right rock) or 'out' (that was
// the last shot: a miss).
export function asteroidsHit(field, rock) {
  if (rock.right) return 'right';
  field.shots--;
  return field.shots <= 0 ? 'out' : 'wrong';
}

// The tier of a hit with `shots` left of `max` (the field's maxShots):
// all = X, one spent = 2, more = 1.
export function asteroidsTier(shots, max = 3) {
  return shots >= max ? 'X' : shots === max - 1 ? '2' : '1';
}

// Where the rocks of a field `width` x `height` px fly, for rocks `rockW`
// wide and up to `most` of them: { n, rockW, rocks: [{ a, d }] } (how
// many, their width, and each one's angle in degrees from straight up
// and distance from the turret's pivot). The most rocks that fit, then
// the widest arc: every rock sits well out in the room its angle has
// (ASTEROIDS.reach, a share of it, alternating so the field isn't a
// neat line), clear above the ship (on a narrow phone field a wide arc
// set rocks level with it, or on it, and a shot starting inside a rock
// missed: Timothy 2026-11-01), and no rock (plus its drift) reaches
// into a neighbour's line of fire. Only when not even 2 fit do the
// rocks get smaller (to ASTEROIDS.rockPxMin): fewer, not smaller, first.
// Null if 2 don't fit at all.
export function asteroidsLayout(width, height, rockW, most) {
  for (let w = rockW; w >= ASTEROIDS.rockPxMin; w -= 2) {
    const lay = asteroidsArc(width, height, w, w === rockW ? most : 2);
    if (lay) return lay;
  }
  return null;
}

function asteroidsArc(width, height, rockW, most) {
  const rad = Math.PI / 180;
  const rockH = rockW * 0.8;
  const r = rockW / 2 + ASTEROIDS.driftPx;
  const halfAngle = d => Math.atan(r / d) / rad;
  for (let n = most; n >= 2; n--) {
    for (let arc = ASTEROIDS.arcMax; arc >= ASTEROIDS.arcMin; arc -= 2) {
      const step = 2 * arc / (n - 1);
      for (const reach of ASTEROIDS.reach) {
        const rocks = [];
        for (let i = 0; i < n; i++) {
          const a = -arc + step * i;
          const sin = Math.abs(Math.sin(a * rad));
          const cos = Math.cos(a * rad);
          const room = Math.min((width / 2 - rockW / 2 - 6) / Math.max(0.01, sin), (height - ASTEROIDS.turretBottom - 10 - rockH / 2) / Math.max(0.01, cos));
          const d = room * reach[i % 2];
          if (d * cos - rockH / 2 - ASTEROIDS.driftPx < ASTEROIDS.turretLength + ASTEROIDS.clearPx) break;
          const prev = rocks[i - 1];
          if (prev && halfAngle(prev.d) + halfAngle(d) + ASTEROIDS.gapDeg > step) break;
          rocks.push({ a, d });
        }
        if (rocks.length === n) return { n, rockW, rocks };
      }
    }
  }
  return null;
}

// ---- Match: the final boss (ship minigames plan step G3) ----

// The board's three kinds of tile from the loaded set: [{ label, words }],
// the three answer kinds (not numbers) with the most short answers (MATCH_BOSS.minWords
// or more of at most maxChars letters each), or the three biggest
// categories when the kinds can't give three; null when neither can. A
// kind's `label` is its name (type.* in text.js, or the category).
export function matchGroups() {
  const data = state.settings.activeData || [];
  const pick = (keyOf, labelOf) => {
    const byKey = new Map();
    data.forEach((q) => {
      const word = normalizeSpaces(q.answer || '');
      const k = keyOf(q);
      if (!k || !word || word.length > MATCH_BOSS.maxChars || q.image) return;
      const words = byKey.get(k) || new Set();
      words.add(word);
      byKey.set(k, words);
    });
    const groups = [...byKey].filter(([, w]) => w.size >= MATCH_BOSS.minWords).sort((a, b) => b[1].size - a[1].size).slice(0, 3);
    return groups.length === 3 ? groups.map(([k, w]) => ({ key: k, label: labelOf(k), words: [...w] })) : null;
  };
  // Numbers (and ports) give themselves away at a glance, so they never
  // make a kind of tile.
  const plain = q => q.answerType !== 'number' && !PORT_LIKE_TYPES.includes(q.answerType);
  return pick(q => (plain(q) ? q.answerType : null), k => k) || pick(q => (plain(q) ? q.category : null), k => k);
}

// A tile of kind `kind` (0-2) from `board`'s groups: a random word of it.
function matchTile(board, kind) {
  const words = board.groups[kind].words;
  return { kind, word: words[Math.floor(Math.random() * words.length)] };
}

// A crisis tile.
const CRISIS = { kind: 'crisis', word: '!!' };

// A new board on `groups` (matchGroups): `cells` (MATCH_BOSS.size squared
// tiles, no line to start with, crisis on MATCH_BOSS.crisisStart), each
// crew slot's `charge`, the `turn`, turns until the crisis next spreads
// (`toSpread`), a spread to skip (`skip`), turns of kinds shown
// (`reveal`), the boss's `phase` (0 Sort, 1 Dark; boss plan step A) and
// whether its one retry is spent (`retried`).
export function matchSetup(groups) {
  const board = { groups, cells: [], charge: [0, 0, 0], turn: 0, toSpread: 0, skip: 0, reveal: 0, phase: 0, retried: false };
  matchFreshPhase(board);
  return board;
}

// Starts `board`'s current phase from the top: new tiles with no line,
// the crisis back on MATCH_BOSS.crisisStart, empty meters, the spread
// count, skip and reveal reset. Each phase is a fresh start (Timothy
// 2026-11-07); only the clock (the view's) carries on.
function matchFreshPhase(board) {
  const n = MATCH_BOSS.size * MATCH_BOSS.size;
  do {
    board.cells = Array.from({ length: n }, () => matchTile(board, Math.floor(Math.random() * 3)));
  } while (matchRuns(board).length);
  MATCH_BOSS.crisisStart.forEach((k) => { board.cells[k] = { ...CRISIS }; });
  board.charge = [0, 0, 0];
  board.toSpread = MATCH_BOSS.spreadEvery;
  board.skip = 0;
  board.reveal = 0;
}

// Whether `board` is on its last phase: winning it wins the boss.
export function matchLastPhase(board) {
  return board.phase >= MATCH_BOSS.phases - 1;
}

// Moves `board` on to its next phase after a won one (not the last), a
// fresh board for it. Phase 1 (Dark) hides the kind colours.
export function matchNextPhase(board) {
  if (matchLastPhase(board)) return false;
  board.phase++;
  matchFreshPhase(board);
  return true;
}

// The boss's one retry (Timothy 2026-11-07): the first loss restarts the
// phase the player was in, from its start. False once it is spent: a
// second loss ends the run.
export function matchRetry(board) {
  if (board.retried) return false;
  board.retried = true;
  matchFreshPhase(board);
  return true;
}

// Whether `board`'s tiles show their kind colours: only in phase 0 (Sort)
// or while a crew member shows the kinds. Phase 1 (Dark) is words only.
export function matchTints(board) {
  return board.phase === 0 || board.reveal > 0;
}

// Every run of 3 or more same-kind tiles in a row or column on `board`:
// [{ kind, cells }]. Crisis tiles never make one.
export function matchRuns(board) {
  const size = MATCH_BOSS.size;
  const runs = [];
  const scan = (at) => {
    let start = 0;
    for (let k = 1; k <= size; k++) {
      const a = board.cells[at(start)];
      const b = k < size ? board.cells[at(k)] : null;
      if (b && b.kind === a.kind) continue;
      if (k - start >= 3 && a.kind !== 'crisis') runs.push({ kind: a.kind, cells: Array.from({ length: k - start }, (_, x) => at(start + x)) });
      start = k;
    }
  };
  for (let r = 0; r < size; r++) scan(c => r * size + c);
  for (let c = 0; c < size; c++) scan(r => r * size + c);
  return runs;
}

// The tiles next to tile `k` (up, down, left, right).
export function matchNear(k) {
  const size = MATCH_BOSS.size;
  return [k - size, k + size, k % size ? k - 1 : -1, k % size < size - 1 ? k + 1 : -1].filter(x => x >= 0 && x < size * size);
}

// Swaps tiles `a` and `b` on `board` (neighbours, neither a crisis): if
// that makes no line it snaps back and the result is { lined: false } (the
// caller spends the turn: the light nudge shows the two kinds). Otherwise
// every line clears, wave by wave: each wave's `hit` tiles go (lines and
// the crisis tiles touching them), the rest fall and new tiles drop in
// (`fall`: how many rows each tile fell; new tiles never make a line by
// themselves; `cells` the board after it; `start` the board just after
// the swap), and `gained` charge per crew slot (1 a line, MATCH_BOSS.bonus
// more for 4 or more). Charge stops at MATCH_BOSS.full.
export function matchSwap(board, a, b) {
  const cells = board.cells;
  if (!matchNear(a).includes(b) || cells[a].kind === 'crisis' || cells[b].kind === 'crisis') return { lined: false, invalid: true };
  [cells[a], cells[b]] = [cells[b], cells[a]];
  if (!matchRuns(board).length) {
    [cells[a], cells[b]] = [cells[b], cells[a]];
    return { lined: false };
  }
  const waves = [];
  const start = cells.map(t => ({ ...t }));
  const size = MATCH_BOSS.size;
  for (let runs = matchRuns(board); runs.length; runs = matchRuns(board)) {
    const hit = new Set();
    const gained = [0, 0, 0];
    runs.forEach((run) => {
      gained[run.kind] += 1 + (run.cells.length >= 4 ? MATCH_BOSS.bonus : 0);
      run.cells.forEach(k => hit.add(k));
    });
    let freed = 0;
    [...hit].forEach(k => matchNear(k).forEach((n) => {
      if (cells[n].kind === 'crisis' && !hit.has(n)) { hit.add(n); freed++; }
    }));
    const fall = {};
    for (let c = 0; c < size; c++) {
      const keep = [];
      for (let r = size - 1; r >= 0; r--) if (!hit.has(r * size + c)) keep.push({ tile: cells[r * size + c], from: r });
      for (let r = size - 1, i = 0; r >= 0; r--, i++) {
        const k = r * size + c;
        if (i < keep.length) { cells[k] = keep[i].tile; if (keep[i].from !== r) fall[k] = r - keep[i].from; }
        else { cells[k] = matchTile(board, Math.floor(Math.random() * 3)); fall[k] = r + 1; }
      }
    }
    // New tiles alone never make a line: chains come from tiles falling.
    const fresh = Object.keys(fall).map(Number).filter(k => fall[k] > Math.floor(k / size));
    for (let tries = 0; tries < 30; tries++) {
      const bad = fresh.filter(k => matchRuns(board).some(run => run.cells.includes(k)));
      if (!bad.length) break;
      bad.forEach((k) => { cells[k] = matchTile(board, Math.floor(Math.random() * 3)); });
    }
    gained.forEach((g, i) => { board.charge[i] = Math.min(MATCH_BOSS.full, board.charge[i] + g); });
    waves.push({ hit: [...hit], fall, gained, freed, cells: cells.map(t => ({ ...t })) });
  }
  return { lined: true, start, waves };
}

// Whether `board`'s phase is won: every crew slot charged full.
export function matchWon(board) {
  return board.charge.every(c => c >= MATCH_BOSS.full);
}

// A turn ends on `board`: kinds shown count down, and every
// MATCH_BOSS.spreadEvery turns the crisis spreads one tile (next to a
// crisis tile, or anywhere if none is left), unless a spread is skipped.
// Returns { spread (the tile, or null), lost (MATCH_BOSS.loseAt reached) }.
export function matchEndTurn(board) {
  board.turn++;
  if (board.reveal > 0) board.reveal--;
  board.toSpread--;
  let spread = null;
  if (board.toSpread <= 0) {
    board.toSpread = MATCH_BOSS.spreadEvery;
    if (board.skip > 0) board.skip = 0;
    else {
      const cells = board.cells;
      const crisis = cells.map((t, k) => (t.kind === 'crisis' ? k : -1)).filter(k => k >= 0);
      const edge = shuffle(crisis.flatMap(matchNear).filter(n => cells[n].kind !== 'crisis'));
      spread = edge.length ? edge[0] : shuffle(cells.map((t, k) => k).filter(k => cells[k].kind !== 'crisis'))[0];
      cells[spread] = { ...CRISIS };
    }
  }
  return { spread, lost: matchCrisis(board) >= MATCH_BOSS.loseAt };
}

// How many crisis tiles `board` has.
export function matchCrisis(board) {
  return board.cells.filter(t => t.kind === 'crisis').length;
}

// Crew slot `slot`'s ability on `board`, spending its charge (it must be
// full): 0 clears every crisis tile in row `row`, 1 skips the crisis's
// next spread, 2 shows every tile's kind for MATCH_BOSS.revealTurns turns.
// Using one sets that slot back from the win: save or spend.
export function matchUse(board, slot, row = 0) {
  if (board.charge[slot] < MATCH_BOSS.full) return false;
  if (slot === 0) {
    for (let c = 0; c < MATCH_BOSS.size; c++) {
      const k = row * MATCH_BOSS.size + c;
      if (board.cells[k].kind === 'crisis') board.cells[k] = matchTile(board, Math.floor(Math.random() * 3));
    }
  } else if (slot === 1) board.skip = 1;
  else board.reveal = MATCH_BOSS.revealTurns;
  board.charge[slot] = 0;
  return true;
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
  const chars = [...q.answer.trim()];
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
  const answer = String(q.answer || '').trim();
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
    if (d.answerType !== 'name' || !/^\p{L}+$/u.test(String(d.answer).trim())) continue;
    if (d.answer.trim().toLowerCase() === answer) continue;
    const split = splitSyllables(d.answer.trim());
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
// `pieces` in order, and `tray`, those pieces and the level's decoys
// (MINIGAME_LEVELS; as many as the set has) from other names, shuffled.
export function syllableSplitTray(q) {
  const pieces = syllableSplitPieces(q);
  const count = levelOf('syllableSplit').decoys;
  const decoys = shuffle(pieceDecoys(pieces)).slice(0, count);
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
    const word = String(d.answer || '').trim().toUpperCase();
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
  const answer = String(q.answer || '').trim();
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
  // One guess per tier, fewer as the player gets good at it (its level).
  const { tiers } = levelOf('codeBreak');
  return { code, digits: code.every(c => /\p{N}/u.test(c)), tiers };
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

// The tier for cracking the code on guess `n` (1-based) of `tiers` (the
// setup's): tiers[n - 1], or null past the last.
export function codeBreakTier(n, tiers = CODE_BREAK_TIERS) {
  return tiers[n - 1] || null;
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
    answers.set(normalizeSpaces(q.answer).toLowerCase(), q.answer);
    byType.set(q.answerType, answers);
  });
  // Cached before the fit check, which reads the answers back from it.
  verdictCache = { data, byType, fitting: [] };
  verdictCache.fitting = data.filter(verdictFits);
  return verdictCache;
}

// The other answers of question `q`'s answerType in the set: what a false
// claim can show. Never one of `q`'s right answers (rightAnswers), or a
// "false" claim would be true.
function verdictDecoys(q) {
  const answers = verdictIndex().byType.get(q.answerType);
  if (!answers) return [];
  const own = rightAnswers(q);
  return [...answers].filter(([key]) => !own.has(key)).map(([, answer]) => answer);
}

// Whether question `q` can be a claim: it has an answerType with
// VERDICT_MIN_DECOYS other answers, no image (a claim shows words only),
// and its wording doesn't hold its answer (a true claim would be free).
function verdictFits(q) {
  return !q.openList && Boolean(q.answerType) && !q.image && !q.letterPool && !answerInStem(q) && verdictDecoys(q).length >= VERDICT_MIN_DECOYS;
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
    if (Math.random() >= VERDICT_FALSE_SHARE) return { q: claim, shown: claim.answer, truth: true };
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
  const answer = String(q.answer || '').trim();
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
  // An open-list question is never the down word either (see FITS).
  return crosswireWords().filter(w => w.q !== q && !w.q.openList && w.word.join('') !== own && inner.some(letter => w.inner.has(letter)));
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
  // Whether the shared letter starts filled in, and REVEAL is offered: by
  // level (MINIGAME_LEVELS).
  const { free, reveal } = levelOf('crosswire');
  return {
    across: { q, word },
    down: { q: partner.q, word: partner.word },
    at: crossings[Math.floor(Math.random() * crossings.length)],
    free, reveal,
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
