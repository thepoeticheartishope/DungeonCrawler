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
  PORT_LIKE_TYPES, HIGHER_LOWER_TIERS, SLOW_SPELL_MIN_LETTERS, SLOW_SPELL_MAX_LETTERS, SLOW_SPELL_X_SHOWN,
  SYLLABLE_SPLIT_MIN_PIECES, SYLLABLE_SPLIT_DECOYS, SYLLABLE_SPLIT_TIERS,
  CODE_BREAK_MIN_CHARS, CODE_BREAK_MAX_CHARS, CODE_BREAK_TIERS,
  VERDICT_CLAIMS, VERDICT_BOSS_CLAIMS, VERDICT_TIERS, VERDICT_BOSS_TIERS, VERDICT_FALSE_SHARE, VERDICT_MIN_DECOYS,
  LETTER_POOL_FORM, LETTER_POOL_WEAK, LETTER_POOL_MIN_LETTERS, LETTER_POOL_MAX_LETTERS,
} from './config.js';
import { numberQuestion, pickQuestion, shuffle, normalizeSpaces } from './quiz.js';
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
};

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
};

// Whether question `q`'s wording holds its own answer ("Spell
// Bartimaeus."): a minigame that spells the answer out would be free.
function answerInStem(q) {
  return String(q.term || '').toLowerCase().includes(String(q.meaning || '').trim().toLowerCase());
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
function pickMinigame(q, offered, group) {
  const mode = state.settings.minigame;
  if (mode === 'off') return null;
  const ids = letterPoolFits(group) ? [...minigamesFor(q), 'letterPool'] : minigamesFor(q);
  const fits = ids.filter(id => modifiersFor(id, offered));
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
