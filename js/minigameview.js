// Draws the minigame a question runs as (minigames plan), in the question
// panel's #minigameSlot, under the question in place of the answer
// options. questionview.js shows and hides it (setMinigame) and passes on
// the modifiers it carries; Timer and Gambler stay the question panel's,
// Blind and Flip are each minigame's own version. A finished minigame
// reports { right, tier, given } (scored by the rules in minigames.js) to
// the callback it was shown with. Calm rule: nothing moves on its own but
// Slow Spell's letters, one every couple of seconds, appearing at once;
// nothing flashes; Blind takes text away once, after a pause.
import { state } from './state.js';
import {
  BLIND_BASE_MS, CLOSE_ENOUGH_TICKS, HIGHER_LOWER_TIERS, HIGHER_LOWER_BLIND_HINT_MS,
  SLOW_SPELL_STEP_MS, SLOW_SPELL_BLIND_LETTER_MS, SLOW_SPELL_FLIP_SHARE, SYLLABLE_SPLIT_TIERS, SYLLABLE_SPLIT_FLIP_SHARE,
} from './config.js';
import {
  closeEnoughDial, closeEnoughTier, higherLowerBar, higherLowerHint, higherLowerTier, slowSpellWord, slowSpellTier,
  syllableSplitTray, syllableSplitTier,
} from './minigames.js';
import { escapeHtml, normalizeSpaces } from './quiz.js';
import { t } from './text.js';

const slot = document.getElementById('minigameSlot');

// The minigame showing: its id, the callback its result goes to, and what
// its own drawing needs (Close Enough: the dial and its elements). Null
// when none shows. View-only, so not in state.
let shown = null;
let blindTimer = null;
// Timers that take a Blind Higher / Lower's hints or Slow Spell's letters
// away.
let hintTimers = [];
// Slow Spell's clock, filling in its letters.
let letterClock = null;

// Builders, one per minigame: each fills `slot` and returns the parts the
// shared code needs: `lock` (its answer button), `finish()` (DEV ->
// Auto-win: plays it out perfectly), `blind()` and `flip()` (its versions
// of those modifiers).
const BUILDERS = {
  closeEnough: buildCloseEnough,
  higherLower: buildHigherLower,
  slowSpell: buildSlowSpell,
  syllableSplit: buildSyllableSplit,
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
  clearTimeout(blindTimer);
  blindTimer = null;
  hintTimers.forEach(clearTimeout);
  hintTimers = [];
  clearInterval(letterClock);
  letterClock = null;
  shown = null;
  slot.hidden = true;
  slot.innerHTML = '';
  slot.className = 'minigame';
}

// Puts the minigame's own Blind or Flip on it.
export function applyMinigameModifier(modifier) {
  if (!shown) return;
  if (modifier === 'blind') blindTimer = setTimeout(() => shown && shown.blind(), BLIND_BASE_MS);
  else if (modifier === 'flip') shown.flip();
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
// Blind hides the reading and the end numbers, leaving the tick marks.
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
    blind: () => slot.classList.add('mod-blind'),
    flip: () => slot.classList.add('mg-flip'),
  };
}

// ---- Higher / Lower: guess on a bar; HIGHER / LOWER narrows it ----
// A miss on a guess says HIGHER or LOWER and the bar narrows to what is
// left. Blind: from then on each hint shows for a moment and goes, and the
// bar stays whole, so the hints must be remembered. Flip runs the bar
// backwards.
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

  // The steps still open (lo..hi), and whether Blind is on.
  let lo = 0;
  let hi = bar.steps;
  let blind = false;
  let guesses = 0;

  const at = () => Number(input.value);
  const show = () => { reading.textContent = formatDial(bar, at()); };
  // The bar spans lo..hi, or all of it under Blind.
  const fit = () => {
    const [a, b] = blind ? [0, bar.steps] : [lo, hi];
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
    if (blind) hintTimers.push(setTimeout(() => line.classList.add('mg-gone'), HIGHER_LOWER_BLIND_HINT_MS));
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
    blind: () => {
      blind = true;
      hints.querySelectorAll('.mg-said').forEach(el => el.classList.add('mg-gone'));
      fit();
    },
    flip: () => slot.classList.add('mg-flip'),
  };
}

// ---- Slow Spell: the answer fills in letter by letter; name it early ----
// A letter fills in every SLOW_SPELL_STEP_MS until one blank is left (the
// clock waits while Gambler locks it). I KNOW IT stops the letters and
// shows four options of the same length; the letters shown then set the
// tier. Blind: from then on each letter shows for a moment and goes blank
// again. Flip: some letters are drawn upside down or mirrored.
function buildSlowSpell() {
  slot.classList.add('mg-spell');
  const word = slowSpellWord(state.battle.currentQuestion);
  add(slot, 'div', 'term-line mg-hint').textContent = t('mg.slowSpell.hint');
  const blanks = add(slot, 'div', 'mg-blanks');
  const count = add(slot, 'div', 'term-line mg-left');
  const lock = add(slot, 'button', 'mg-lock');
  const options = add(slot, 'div', 'mg-options');

  lock.type = 'button';
  lock.textContent = t('mg.slowSpell.know');
  blanks.setAttribute('aria-label', t('mg.slowSpell'));
  const cells = word.chars.map(c => {
    const cell = add(blanks, 'span', 'mg-letter');
    cell.textContent = /\p{L}/u.test(c) ? '_' : c;
    return cell;
  });

  // Letters filled in so far, Blind and Flip (its look, or null), and the
  // tier once I KNOW IT is pressed.
  let filled = 0;
  let blind = false;
  let flip = null;
  let tier = null;

  const showCount = () => { count.textContent = t('mg.slowSpell.shown', { n: filled, total: word.total }); };
  // Puts a letter's place back to a blank (Blind).
  const blank = (cell) => {
    cell.textContent = '_';
    cell.className = 'mg-letter';
  };
  const fillNext = () => {
    if (lock.disabled) return;
    const cell = cells[word.order[filled]];
    cell.textContent = word.chars[word.order[filled]];
    if (flip && Math.random() < SLOW_SPELL_FLIP_SHARE) cell.classList.add('flip-' + flip);
    filled++;
    showCount();
    if (blind) hintTimers.push(setTimeout(() => blank(cell), SLOW_SPELL_BLIND_LETTER_MS));
    if (filled >= word.stopAt) know();
  };
  const pick = (choice) => {
    const right = normalizeSpaces(choice).toLowerCase() === normalizeSpaces(word.chars.join('')).toLowerCase();
    finish({ right, tier: right ? tier : null, given: choice });
  };
  // I KNOW IT (or one blank left): the letters stop and the options show.
  const know = () => {
    if (tier) return;
    clearInterval(letterClock);
    letterClock = null;
    tier = slowSpellTier(filled, word.total);
    lock.hidden = true;
    const letters = ['A', 'B', 'C', 'D'];
    word.choices.forEach((choice, i) => {
      const btn = add(options, 'button', 'mc-option');
      btn.type = 'button';
      btn.innerHTML = '<span class="letter">' + letters[i] + '</span><span class="opt-text">' + escapeHtml(choice) + '</span>';
      btn.addEventListener('click', () => pick(choice));
    });
    options.querySelector('button').focus();
  };
  lock.addEventListener('click', know);
  // The options keep their keys: 1-4 or A-D pick one (not a fight choice).
  // On the options, not the slot: the slot outlives this minigame.
  options.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    const i = '1234'.includes(e.key) ? Number(e.key) - 1 : 'abcd'.indexOf(e.key.toLowerCase());
    if (i < 0 || !word.choices[i]) return;
    e.preventDefault();
    e.stopPropagation();
    if (!shown.done) pick(word.choices[i]);
  });
  letterClock = setInterval(fillNext, SLOW_SPELL_STEP_MS);
  showCount();

  return {
    lock,
    focus: () => lock.focus(),
    finish: () => {
      filled = 0;
      tier = null;
      know();
      pick(word.chars.join(''));
    },
    blind: () => {
      blind = true;
      cells.forEach((cell, i) => { if (word.order.indexOf(i) < filled) blank(cell); });
    },
    flip: () => { flip = Math.random() < 0.5 ? 'upside' : 'mirror'; },
  };
}

// ---- Syllable Split: build the name from a tray of pieces ----
// Pick the name's pieces in order; each lands in the next blank. A wrong
// piece is struck out and costs a step down (SYLLABLE_SPLIT_TIERS); past
// the last it is a miss. Pieces are shown in capitals, so the first
// piece's capital doesn't give it away. Gambler locks the whole tray (a
// fieldset). Blind: the tray's pieces go blank, the built part stays.
// Flip: some pieces are drawn upside down or mirrored.
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
    blind: () => lock.classList.add('mod-blind'),
    flip: () => {
      const mode = Math.random() < 0.5 ? 'upside' : 'mirror';
      buttons.forEach(btn => { if (Math.random() < SYLLABLE_SPLIT_FLIP_SHARE) btn.firstChild.classList.add('flip-' + mode); });
    },
  };
}

// Dial step `at` as the player reads it: thousands separated, as many
// decimals as a step has, and the answer's unit ("40", "1,500 %").
function formatDial(dial, at) {
  const decimals = Math.max(0, -Math.floor(Math.log10(dial.step)));
  const value = (at * dial.step).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return dial.unit ? value + ' ' + dial.unit.toUpperCase() : value;
}
