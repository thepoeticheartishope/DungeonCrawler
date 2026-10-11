// Draws the minigame a question runs as (minigames plan), in the question
// panel's #minigameSlot, under the question in place of the answer
// options. questionview.js shows and hides it (setMinigame) and passes on
// the modifiers it carries; Timer and Gambler stay the question panel's,
// Blind and Flip are each minigame's own version. A finished minigame
// reports { right, tier, given } (scored by the rules in minigames.js) to
// the callback it was shown with. Calm rule: nothing moves on its own,
// nothing flashes; Blind takes text away once, after a pause.
import { state } from './state.js';
import { BLIND_BASE_MS, CLOSE_ENOUGH_TICKS } from './config.js';
import { closeEnoughDial, closeEnoughTier } from './minigames.js';
import { t } from './text.js';

const slot = document.getElementById('minigameSlot');

// The minigame showing: its id, the callback its result goes to, and what
// its own drawing needs (Close Enough: the dial and its elements). Null
// when none shows. View-only, so not in state.
let shown = null;
let blindTimer = null;

// Builders, one per minigame: each fills `slot` and returns the parts the
// shared code needs: `lock` (its answer button), `finish()` (DEV ->
// Auto-win: plays it out perfectly), `blind()` and `flip()` (its versions
// of those modifiers).
const BUILDERS = {
  closeEnough: buildCloseEnough,
};

// Shows minigame `id` for the question showing, sending its result to
// `report`. Null hides it.
export function showMinigame(id, report) {
  hideMinigame();
  if (!id) return;
  slot.innerHTML = '';
  shown = { id, report, ...BUILDERS[id]() };
  slot.hidden = false;
  shown.focus();
}

// Takes the minigame away (a new question is set).
export function hideMinigame() {
  clearTimeout(blindTimer);
  blindTimer = null;
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

// Dial step `at` as the player reads it: thousands separated, as many
// decimals as a step has, and the answer's unit ("40", "1,500 %").
function formatDial(dial, at) {
  const decimals = Math.max(0, -Math.floor(Math.log10(dial.step)));
  const value = (at * dial.step).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return dial.unit ? value + ' ' + dial.unit.toUpperCase() : value;
}
