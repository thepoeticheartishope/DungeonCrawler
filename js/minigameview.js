// Draws the minigame a question runs as (minigames plan), in the question
// panel's #minigameSlot, under the question in place of the answer
// options. questionview.js shows and hides it (setMinigame) and passes on
// the modifiers it carries; Blind, Timer and Gambler stay the question
// panel's (Blind hides the question), Flip is each minigame's own version.
// A finished minigame
// reports { right, tier, given } (scored by the rules in minigames.js) to
// the callback it was shown with. Calm rule: nothing moves on its own but
// Slow Spell's letters, one every couple of seconds, appearing at once;
// nothing flashes.
import { state } from './state.js';
import {
  CLOSE_ENOUGH_TICKS, HIGHER_LOWER_TIERS,
  SLOW_SPELL_STEP_MS, SLOW_SPELL_FLIP_SHARE, SYLLABLE_SPLIT_TIERS, SYLLABLE_SPLIT_FLIP_SHARE,
  LETTER_POOL_FORM, LETTER_POOL_TIMER_SECONDS, LETTER_POOL_FLIP_SHARE, CODE_BREAK_TIERS,
} from './config.js';
import {
  closeEnoughDial, closeEnoughTier, higherLowerBar, higherLowerHint, higherLowerTier, slowSpellWord, slowSpellTier, slowSpellMatches,
  syllableSplitTray, syllableSplitTier, letterPoolCheck, letterPoolTier,
  codeChars, codeBreakSetup, codeBreakMarks, codeBreakTier,
} from './minigames.js';
import { normalizeSpaces } from './quiz.js';
import { t } from './text.js';

const slot = document.getElementById('minigameSlot');

// The minigame showing: its id, the callback its result goes to, and what
// its own drawing needs (Close Enough: the dial and its elements). Null
// when none shows. View-only, so not in state.
let shown = null;
// Slow Spell's clock, filling in its letters.
let letterClock = null;

// Builders, one per minigame: each fills `slot` and returns the parts the
// shared code needs: `lock` (its answer button), `finish()` (DEV ->
// Auto-win: plays it out perfectly), `flip()` (its version of Flip), and
// if it differs, `seconds` (the Timer's clock) and `timeUp()` (the Timer ran out: score
// what was done, instead of a miss).
const BUILDERS = {
  closeEnough: buildCloseEnough,
  higherLower: buildHigherLower,
  slowSpell: buildSlowSpell,
  syllableSplit: buildSyllableSplit,
  letterPool: buildLetterPool,
  codeBreak: buildCodeBreak,
};

// Shows minigame `id` for the question showing, sending its result to
// `report`. `again()` is called when a minigame of several tries starts a
// new one (the Timer starts over). Null hides it.
export function showMinigame(id, report, again = () => {}) {
  hideMinigame();
  if (!id) return;
  slot.innerHTML = '';
  shown = { id, report, again, ...BUILDERS[id]() };
  slot.hidden = false;
  shown.focus();
}

// Takes the minigame away (a new question is set).
export function hideMinigame() {
  clearInterval(letterClock);
  letterClock = null;
  shown = null;
  slot.hidden = true;
  slot.innerHTML = '';
  slot.className = 'minigame';
}

// Puts the minigame's own Flip on it.
export function applyMinigameModifier(modifier) {
  if (shown && modifier === 'flip') shown.flip();
}

// The Timer's seconds for the minigame showing, or null for the usual.
export function minigameSeconds() {
  return (shown && shown.seconds) || null;
}

// The Timer ran out. True when the minigame showing scored itself (a
// Letter Pool scores what was formed); false leaves it a miss.
export function minigameTimeUp() {
  if (!shown || !shown.timeUp || shown.done) return false;
  shown.timeUp();
  return true;
}

// Gambler: the minigame can't be answered until a wager is placed.
export function lockMinigame(locked) {
  if (shown) shown.lock.disabled = locked;
}

// DEV -> Auto-win: plays the minigame showing out perfectly (tier X).
export function playMinigameOut() {
  if (shown) shown.finish();
}

// Sends the result once and freezes the minigame, so a second press
// can't answer twice.
function finish(result) {
  if (!shown || shown.done) return;
  shown.done = true;
  slot.querySelectorAll('button, input').forEach(el => { el.disabled = true; });
  shown.report(result);
}

// A new element of `tag` with `className`, added to `parent`.
function add(parent, tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  parent.appendChild(el);
  return el;
}

// ---- Close Enough: a dial from 0 past the answer; LOCK sets it ----
// Flip runs the dial backwards (its top on the left).
function buildCloseEnough() {
  slot.classList.add('mg-close');
  const dial = closeEnoughDial(state.battle.currentQuestion);
  add(slot, 'div', 'term-line mg-hint').textContent = t('mg.closeEnough.hint');
  const reading = add(slot, 'div', 'mg-reading');
  const row = add(slot, 'div', 'mg-dial-row');
  const less = add(row, 'button', 'mg-nudge');
  const track = add(row, 'div', 'mg-track');
  const more = add(row, 'button', 'mg-nudge');
  const input = add(track, 'input', 'mg-dial');
  const ticks = add(track, 'div', 'mg-ticks');
  const ends = add(track, 'div', 'mg-ends');
  const low = add(ends, 'span');
  const high = add(ends, 'span');
  const lock = add(slot, 'button', 'mg-lock');

  less.type = more.type = lock.type = 'button';
  less.textContent = '-';
  more.textContent = '+';
  less.setAttribute('aria-label', t('mg.closeEnough.less'));
  more.setAttribute('aria-label', t('mg.closeEnough.more'));
  lock.textContent = t('mg.closeEnough.lock');
  input.type = 'range';
  input.min = '0';
  input.max = String(dial.steps);
  input.step = '1';
  input.value = '0';
  input.setAttribute('aria-label', t('mg.closeEnough'));
  for (let i = 0; i <= CLOSE_ENOUGH_TICKS; i++) add(ticks, 'span');
  low.textContent = formatDial(dial, 0);
  high.textContent = formatDial(dial, dial.steps);

  const at = () => Number(input.value);
  const show = () => { reading.textContent = formatDial(dial, at()); };
  const nudge = (by) => {
    input.value = String(Math.min(dial.steps, Math.max(0, at() + by)));
    show();
  };
  const settle = () => {
    const tier = closeEnoughTier(dial, at());
    finish({ right: tier !== null, tier, given: formatDial(dial, at()) });
  };
  input.addEventListener('input', show);
  less.addEventListener('click', () => nudge(-1));
  more.addEventListener('click', () => nudge(1));
  lock.addEventListener('click', settle);
  // The dial keeps its keys: arrows move it (not the player), Enter locks.
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!lock.disabled) settle();
  });
  show();

  return {
    lock,
    focus: () => input.focus(),
    finish: () => {
      input.value = String(dial.answerAt);
      show();
      settle();
    },
    flip: () => slot.classList.add('mg-flip'),
  };
}

// ---- Higher / Lower: guess on a bar; HIGHER / LOWER narrows it ----
// A miss on a guess says HIGHER or LOWER and the bar narrows to what is
// left. Flip runs the bar backwards.
function buildHigherLower() {
  slot.classList.add('mg-higher');
  const bar = higherLowerBar(state.battle.currentQuestion);
  add(slot, 'div', 'term-line mg-hint').textContent = t('mg.higherLower.hint', { n: HIGHER_LOWER_TIERS.length });
  const reading = add(slot, 'div', 'mg-reading');
  const row = add(slot, 'div', 'mg-dial-row');
  const less = add(row, 'button', 'mg-nudge');
  const track = add(row, 'div', 'mg-track');
  const more = add(row, 'button', 'mg-nudge');
  const input = add(track, 'input', 'mg-dial');
  const ends = add(track, 'div', 'mg-ends');
  const low = add(ends, 'span');
  const high = add(ends, 'span');
  const hints = add(slot, 'div', 'mg-hints');
  const left = add(slot, 'div', 'term-line mg-left');
  const lock = add(slot, 'button', 'mg-lock');

  less.type = more.type = lock.type = 'button';
  less.textContent = '-';
  more.textContent = '+';
  less.setAttribute('aria-label', t('mg.closeEnough.less'));
  more.setAttribute('aria-label', t('mg.closeEnough.more'));
  lock.textContent = t('mg.higherLower.guess');
  input.type = 'range';
  input.step = '1';
  input.value = '0';
  input.setAttribute('aria-label', t('mg.higherLower'));
  hints.setAttribute('aria-live', 'polite');

  // The steps still open (lo..hi).
  let lo = 0;
  let hi = bar.steps;
  let guesses = 0;

  const at = () => Number(input.value);
  const show = () => { reading.textContent = formatDial(bar, at()); };
  // The bar spans what is still open.
  const fit = () => {
    const [a, b] = [lo, hi];
    input.min = String(a);
    input.max = String(b);
    input.value = String(Math.min(b, Math.max(a, at())));
    low.textContent = formatDial(bar, a);
    high.textContent = formatDial(bar, b);
    left.textContent = t('mg.higherLower.left', { n: HIGHER_LOWER_TIERS.length - guesses });
    show();
  };
  const nudge = (by) => {
    input.value = String(Math.min(Number(input.max), Math.max(Number(input.min), at() + by)));
    show();
  };
  const guess = () => {
    const g = at();
    guesses++;
    const hint = higherLowerHint(bar, g);
    if (hint === 'hit') {
      finish({ right: true, tier: higherLowerTier(guesses), given: formatDial(bar, g) });
      return;
    }
    if (hint === 'higher') lo = Math.max(lo, g + 1);
    else hi = Math.min(hi, g - 1);
    const line = add(hints, 'div', 'term-line mg-said');
    line.textContent = t('mg.higherLower.' + hint, { n: formatDial(bar, g) });
    if (guesses >= HIGHER_LOWER_TIERS.length) {
      finish({ right: false, tier: null, given: formatDial(bar, g) });
      return;
    }
    fit();
    shown.again();
  };
  input.addEventListener('input', show);
  less.addEventListener('click', () => nudge(-1));
  more.addEventListener('click', () => nudge(1));
  lock.addEventListener('click', guess);
  // The bar keeps its keys: arrows move it (not the player), Enter guesses.
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!lock.disabled) guess();
  });
  fit();

  return {
    lock,
    focus: () => input.focus(),
    finish: () => {
      input.min = '0';
      input.max = String(bar.steps);
      input.value = String(bar.answerAt);
      guesses = 0;
      guess();
    },
    flip: () => slot.classList.add('mg-flip'),
  };
}

// ---- Slow Spell: the answer fills in letter by letter; name it early ----
// A letter fills in every SLOW_SPELL_STEP_MS until one blank is left (the
// clock waits while Gambler locks it). I KNOW IT stops the letters, the
// letters shown then set the tier, and the answer is typed (one try).
// Flip: some letters are drawn upside down or mirrored.
function buildSlowSpell() {
  slot.classList.add('mg-spell');
  const word = slowSpellWord(state.battle.currentQuestion);
  add(slot, 'div', 'term-line mg-hint').textContent = t('mg.slowSpell.hint');
  const blanks = add(slot, 'div', 'mg-blanks');
  const count = add(slot, 'div', 'term-line mg-left');
  const lock = add(slot, 'button', 'mg-lock');
  // The typed answer, shown once I KNOW IT stops the letters.
  const form = add(slot, 'form', 'term-input-row mg-type');
  const input = add(form, 'input');
  const enter = add(form, 'button');
  form.hidden = true;
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
  input.placeholder = t('mg.slowSpell.typePlaceholder');
  input.setAttribute('aria-label', t('mg.slowSpell.typePlaceholder'));
  enter.type = 'submit';
  enter.textContent = t('mg.slowSpell.enter');

  lock.type = 'button';
  lock.textContent = t('mg.slowSpell.know');
  blanks.setAttribute('aria-label', t('mg.slowSpell'));
  const cells = word.chars.map(c => {
    const cell = add(blanks, 'span', 'mg-letter');
    cell.textContent = /\p{L}/u.test(c) ? '_' : c;
    return cell;
  });

  // Letters filled in so far, Flip (its look, or null), and the tier once
  // I KNOW IT is pressed.
  let filled = 0;
  let flip = null;
  let tier = null;

  const showCount = () => { count.textContent = t('mg.slowSpell.shown', { n: filled, total: word.total }); };
  const fillNext = () => {
    if (lock.disabled) return;
    const cell = cells[word.order[filled]];
    cell.textContent = word.chars[word.order[filled]];
    if (flip && Math.random() < SLOW_SPELL_FLIP_SHARE) cell.classList.add('flip-' + flip);
    filled++;
    showCount();
    if (filled >= word.stopAt) know();
  };
  // One try: a right spelling scores the tier set when the letters
  // stopped, anything else is a miss. An empty answer is no answer yet.
  const answer = (typed) => {
    if (!normalizeSpaces(typed)) return;
    const right = slowSpellMatches(word, typed);
    finish({ right, tier: right ? tier : null, given: normalizeSpaces(typed) });
  };
  // I KNOW IT (or one blank left): the letters stop, the tier is set, and
  // the answer is typed.
  const know = () => {
    if (tier) return;
    clearInterval(letterClock);
    letterClock = null;
    tier = slowSpellTier(filled, word.total);
    lock.hidden = true;
    form.hidden = false;
    input.focus();
  };
  lock.addEventListener('click', know);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    answer(input.value);
  });
  // Typed letters are the answer's, not the game's keys (F fires, L opens
  // the log, A-D pick an option on the ask screen).
  input.addEventListener('keydown', e => e.stopPropagation());
  letterClock = setInterval(fillNext, SLOW_SPELL_STEP_MS);
  showCount();

  return {
    lock,
    focus: () => lock.focus(),
    finish: () => {
      filled = 0;
      tier = null;
      know();
      answer(word.chars.join(''));
    },
    flip: () => { flip = Math.random() < 0.5 ? 'upside' : 'mirror'; },
  };
}

// ---- Syllable Split: build the name from a tray of pieces ----
// Pick the name's pieces in order; each lands in the next blank. A wrong
// piece is struck out and costs a step down (SYLLABLE_SPLIT_TIERS); past
// the last it is a miss. Pieces are shown in capitals, so the first
// piece's capital doesn't give it away. Gambler locks the whole tray (a
// fieldset). Flip: some pieces are drawn upside down or mirrored.
function buildSyllableSplit() {
  slot.classList.add('mg-split');
  const { pieces, tray } = syllableSplitTray(state.battle.currentQuestion);
  add(slot, 'div', 'term-line mg-hint').textContent = t('mg.syllableSplit.hint');
  const built = add(slot, 'div', 'mg-built');
  const left = add(slot, 'div', 'term-line mg-left');
  const lock = add(slot, 'fieldset', 'mg-tray');

  const blanks = pieces.map(() => {
    const cell = add(built, 'span', 'mg-piece-slot');
    cell.textContent = '___';
    return cell;
  });
  const buttons = tray.map(piece => {
    const btn = add(lock, 'button', 'mg-piece');
    btn.type = 'button';
    add(btn, 'span').textContent = piece.toUpperCase();
    btn.addEventListener('click', () => pick(btn, piece));
    return btn;
  });

  // The next piece to find, and the wrong picks so far.
  let next = 0;
  let wrong = 0;
  const showLeft = () => { left.textContent = t('mg.syllableSplit.left', { n: SYLLABLE_SPLIT_TIERS.length - 1 - wrong }); };
  const given = () => pieces.slice(0, next).join('');
  const pick = (btn, piece) => {
    btn.disabled = true;
    if (piece.toLowerCase() !== pieces[next].toLowerCase()) {
      btn.classList.add('mg-struck');
      wrong++;
      showLeft();
      if (!syllableSplitTier(wrong)) finish({ right: false, tier: null, given: given() || t('battle.noAnswer') });
      return;
    }
    btn.classList.add('mg-used');
    blanks[next].textContent = pieces[next].toUpperCase();
    next++;
    if (next === pieces.length) finish({ right: true, tier: syllableSplitTier(wrong), given: given() });
  };
  showLeft();

  return {
    lock,
    focus: () => buttons[0].focus(),
    finish: () => {
      while (next < pieces.length) {
        const btn = buttons.find(b => !b.disabled && b.textContent === pieces[next].toUpperCase());
        pick(btn, pieces[next]);
      }
    },
    flip: () => {
      const mode = Math.random() < 0.5 ? 'upside' : 'mirror';
      buttons.forEach(btn => { if (Math.random() < SYLLABLE_SPLIT_FLIP_SHARE) btn.firstChild.classList.add('flip-' + mode); });
    },
  };
}

// ---- Letter Pool: spell the category's answers from a tray ----
// The stand-in question names the category and the count to form. Tap
// tiles (or type) to spell, ENTER checks the word: an answer of the
// category is formed (a hidden one is marked), anything else is said so.
// Letters are used again freely. DONE ends it and scores what was formed;
// finding every hidden answer ends it at X. Gambler locks the whole tray
// (a fieldset). Flip: some tiles are drawn upside down or mirrored. Timer: a longer
// clock, and time up scores what was formed.
function buildLetterPool() {
  slot.classList.add('mg-pool');
  const pool = state.battle.currentQuestion.letterPool;
  add(slot, 'div', 'term-line mg-hint').textContent = t('mg.letterPool.hint');
  const reading = add(slot, 'div', 'mg-reading');
  const lock = add(slot, 'fieldset', 'mg-tray');
  const tiles = add(lock, 'div', 'mg-tiles');
  const keys = add(lock, 'div', 'mg-pool-keys');
  const back = add(keys, 'button', 'mg-nudge');
  const enter = add(keys, 'button', 'mg-lock');
  const done = add(keys, 'button', 'mg-lock');
  const said = add(slot, 'div', 'term-line mg-said');
  const count = add(slot, 'div', 'term-line mg-left');
  const list = add(slot, 'div', 'mg-found');

  back.type = enter.type = done.type = 'button';
  back.textContent = '<';
  back.setAttribute('aria-label', t('mg.letterPool.back'));
  enter.textContent = t('mg.letterPool.enter');
  done.textContent = t('mg.letterPool.done');
  said.setAttribute('aria-live', 'polite');
  const buttons = pool.tiles.map(letter => {
    const btn = add(tiles, 'button', 'mg-tile');
    btn.type = 'button';
    add(btn, 'span').textContent = letter;
    btn.addEventListener('click', () => type(letter));
    return btn;
  });

  // The word being spelled, and the answers formed so far.
  let word = '';
  const formed = [];
  const hiddenFound = () => formed.filter(w => pool.hidden.includes(w)).length;
  const show = () => { reading.textContent = word || ' '; };
  const showCount = () => {
    count.textContent = t('mg.letterPool.count', { n: formed.length, form: LETTER_POOL_FORM, hidden: hiddenFound(), of: pool.hidden.length });
  };
  const type = (letter) => {
    if (word.length >= 12) return;
    word += letter;
    show();
  };
  const score = () => {
    const tier = letterPoolTier(pool, formed.length, hiddenFound());
    const given = formed.map(w => w[0] + w.slice(1).toLowerCase()).join(', ') || t('battle.noAnswer');
    finish({ right: tier !== null, tier, given });
  };
  const check = () => {
    if (!word) return;
    const kind = formed.includes(word) ? 'again' : letterPoolCheck(pool, word);
    said.textContent = t('mg.letterPool.said.' + kind, { word, label: pool.label });
    if (kind === 'hidden' || kind === 'valid') {
      formed.push(word);
      const line = add(list, 'span', kind === 'hidden' ? 'mg-hidden' : '');
      line.textContent = word;
      showCount();
    }
    word = '';
    show();
    if (hiddenFound() === pool.hidden.length) score();
  };
  back.addEventListener('click', () => { word = word.slice(0, -1); show(); });
  enter.addEventListener('click', check);
  done.addEventListener('click', score);
  // Typing spells too: a tray letter adds it, Backspace takes one off,
  // Enter checks. On the tray, not the slot: the slot outlives this
  // minigame. Letters are kept from the map's keys (M is the minimap).
  lock.addEventListener('keydown', (e) => {
    const letter = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (pool.tiles.includes(letter)) type(letter);
    else if (e.key === 'Backspace') back.click();
    else if (e.key === 'Enter') check();
    else if (!/^\p{L}$/u.test(letter)) return;
    e.preventDefault();
    e.stopPropagation();
  });
  show();
  showCount();

  return {
    lock,
    focus: () => buttons[0].focus(),
    seconds: LETTER_POOL_TIMER_SECONDS,
    timeUp: score,
    finish: () => {
      pool.hidden.filter(w => !formed.includes(w)).forEach((w) => {
        word = w;
        check();
      });
    },
    flip: () => {
      const mode = Math.random() < 0.5 ? 'upside' : 'mirror';
      buttons.forEach(btn => { if (Math.random() < LETTER_POOL_FLIP_SHARE) btn.firstChild.classList.add('flip-' + mode); });
    },
  };
}

// ---- Code Break: guess the answer as a code; each guess is marked ----
// The code shows as a row of blanks per guess. A guess of the code's
// length (typed; Enter or TRY) fills the next row and marks each
// character: right place (inverse), elsewhere in the code (dashed box) or
// not in it (dim). A guess of another length isn't one. Cracked on guess
// n pays CODE_BREAK_TIERS[n - 1]; out of rows is a miss. Each guess calls
// again() (the Timer is per guess). Gambler locks the form (a fieldset).
// Flip: the guesses before the newest are drawn upside down or mirrored,
// each character in its place.
function buildCodeBreak() {
  slot.classList.add('mg-code');
  const setup = codeBreakSetup(state.battle.currentQuestion);
  const size = setup.code.length;
  add(slot, 'div', 'term-line mg-hint').textContent = t('mg.codeBreak.hint', { n: CODE_BREAK_TIERS.length });
  const legend = add(slot, 'div', 'mg-code-key');
  ['hit', 'near', 'miss'].forEach((mark) => {
    const item = add(legend, 'span');
    add(item, 'span', 'mg-code-cell mg-code-' + mark).textContent = 'A';
    add(item, 'span').textContent = t('mg.codeBreak.mark.' + mark);
  });
  const board = add(slot, 'div', 'mg-code-rows');
  const rows = CODE_BREAK_TIERS.map(() => {
    const row = add(board, 'div', 'mg-code-row');
    for (let i = 0; i < size; i++) add(row, 'span', 'mg-code-cell').textContent = '_';
    return row;
  });
  const said = add(slot, 'div', 'term-line mg-said');
  const left = add(slot, 'div', 'term-line mg-left');
  const lock = add(slot, 'fieldset', 'mg-code-form');
  const form = add(lock, 'form', 'term-input-row mg-type');
  const input = add(form, 'input');
  const enter = add(form, 'button');

  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.maxLength = size;
  input.setAttribute('autocapitalize', 'characters');
  input.setAttribute('autocorrect', 'off');
  if (setup.digits) input.inputMode = 'numeric';
  input.placeholder = t('mg.codeBreak.placeholder', { n: size });
  input.setAttribute('aria-label', t('mg.codeBreak.placeholder', { n: size }));
  enter.type = 'submit';
  enter.textContent = t('mg.codeBreak.try');
  said.setAttribute('aria-live', 'polite');

  // Guesses made, and Flip's look (or null).
  let guesses = 0;
  let flip = null;
  const showLeft = () => { left.textContent = t('mg.codeBreak.left', { n: CODE_BREAK_TIERS.length - guesses }); };
  const guess = (typed) => {
    const marks = codeBreakMarks(setup, typed);
    if (!marks) {
      said.textContent = t('mg.codeBreak.length', { n: size });
      return;
    }
    const chars = codeChars(typed);
    const row = rows[guesses];
    [...row.children].forEach((cell, i) => {
      cell.textContent = chars[i];
      cell.className = 'mg-code-cell mg-code-' + marks[i];
    });
    row.setAttribute('aria-label', chars.map((c, i) => c + ' ' + t('mg.codeBreak.mark.' + marks[i])).join(', '));
    guesses++;
    input.value = '';
    said.textContent = '';
    if (flip) rows.slice(0, guesses - 1).forEach(r => [...r.children].forEach(cell => cell.classList.add('flip-' + flip)));
    if (marks.every(m => m === 'hit')) {
      finish({ right: true, tier: codeBreakTier(guesses), given: chars.join('') });
      return;
    }
    if (guesses >= CODE_BREAK_TIERS.length) {
      finish({ right: false, tier: null, given: chars.join('') });
      return;
    }
    showLeft();
    shown.again();
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (normalizeSpaces(input.value)) guess(input.value);
  });
  // Typed characters are the guess's, not the game's keys.
  input.addEventListener('keydown', e => e.stopPropagation());
  showLeft();

  return {
    lock,
    focus: () => input.focus(),
    finish: () => guess(setup.code.join('')),
    flip: () => { flip = Math.random() < 0.5 ? 'upside' : 'mirror'; },
  };
}

// Dial step `at` as the player reads it: thousands separated, as many
// decimals as a step has, and the answer's unit ("40", "1,500 %").
function formatDial(dial, at) {
  const decimals = Math.max(0, -Math.floor(Math.log10(dial.step)));
  const value = (at * dial.step).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return dial.unit ? value + ' ' + dial.unit.toUpperCase() : value;
}
