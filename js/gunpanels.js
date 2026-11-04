// The ask screen (gun plan step 5; the gun itself went in dungeon removal
// step C): the one question panel from questionview.js, moved onto the
// record book in place of the map and the controls, for a breaker, a crew
// member's job, learning a role and the final boss. One shows at a time
// with CHARGE.SYS, COMMAND.SYS and the book read from the map.
// gunactions.js opens it; this only draws and listens.

import { mountQuestionPanel } from './questionview.js';
import { t } from './text.js';
import { chargerShown, hideCharger } from './chargerview.js';
import { consoleShown, hideConsole } from './consoleview.js';
import { refreshBook, bookAsks, bookReading, showAskTab } from './bookview.js';

const els = {};

// Looks up the ask screen and hooks up BACK, and Escape for it. Call once,
// from main.js.
export function initGunPanels() {
  els.room = document.getElementById('roomScreen');
  els.ask = document.getElementById('askScreen');
  els.askTitle = document.getElementById('askTitle');
  els.question = document.getElementById('askQuestionPanel');
  els.questionSlot = document.getElementById('askQuestionSlot');
  els.askBack = document.getElementById('askBack');
  els.askBack.addEventListener('click', () => { if (backAction && !askHeld()) backAction(); });
  els.close = document.getElementById('bookClose');
  document.addEventListener('keydown', (e) => {
    if (mapPanelShown() === 'question' && backAction && !askHeld() && e.key === 'Escape') {
      e.preventDefault();
      backAction();
    }
  });
}

// Which panel shows: 'question' (on the ask screen), 'charger' (CHARGE.SYS
// over the map, chargerview.js), 'console' (COMMAND.SYS), 'book' (the
// record book read from the map for LOG or MAP, bookview.js), or null.
export function mapPanelShown() {
  if (!els.question) return null;
  if (!els.question.hidden) return 'question';
  if (chargerShown()) return 'charger';
  if (consoleShown()) return 'console';
  if (bookReading()) return 'book';
  return null;
}

// Shows the question on the ask screen in place of the map and the
// controls (`on`), drawn as the record book (bookview.js), refreshed each
// time it opens, or puts the map back. Either ends a book read from the map.
function showAsk(on) {
  els.question.hidden = !on;
  if (!on && heldClose) dropHeld();
  bookAsks(on);
  els.ask.hidden = !on;
  els.room.classList.toggle('asking', on);
  if (on) refreshBook();
}

// Moves the question panel to the ask screen and shows it, titled for
// `kind` ('breaker', 'job', 'boss'), or `title` when given (a crew
// member's job: their role and the round). `answers` are the question
// panel's handlers (questionview.js mountQuestionPanel): what a right or
// wrong answer does here. With `back` a BACK button shows under the
// question (and Escape does the same) until an answer is in: learning
// (crew roles).
export function showQuestionScreen(answers, kind, title = null, back = null) {
  els.askTitle.textContent = title || t('ask.title.' + kind);
  backAction = back;
  els.askBack.hidden = !back;
  mountQuestionPanel(els.questionSlot, answers);
  showAsk(true);
}

// What closes the book once an answer is in (holdAskScreen), or null.
let heldClose = null;
// What BACK on the question does (showQuestionScreen's `back`), or null.
let backAction = null;

// Holds the ask screen open once an answer is in (record book plan step
// C), so the struck pick and the written answer can be read: a tap on the
// book or any key closes it and runs `onClose` (which settles the answer
// and closes the ask screen). The clock stays paused until then. The
// listeners go on after this event is done, so the tap or key that gave
// the answer doesn't close it too.
export function holdAskScreen(onClose) {
  showAskTab();
  heldClose = onClose;
  els.close.hidden = false;
  els.askBack.hidden = true;
  setTimeout(() => {
    if (heldClose !== onClose) return;
    els.ask.addEventListener('click', closeHeldAsk);
    addEventListener('keydown', closeOnKey, true);
  }, 0);
}

// Whether the ask screen is held open after an answer.
export function askHeld() {
  return heldClose !== null;
}

// Closes the book held open after an answer (a tap, a key, DEV -> Auto-win).
export function closeHeldAsk() {
  const close = heldClose;
  if (!close) return;
  dropHeld();
  close();
}

// Lets go of a held book without closing it: closeHeldAsk, or the ask
// screen closed some other way (showOnly), so the next answer isn't stuck.
function dropHeld() {
  heldClose = null;
  els.close.hidden = true;
  els.ask.removeEventListener('click', closeHeldAsk);
  removeEventListener('keydown', closeOnKey, true);
}

// A key closes the held book, and goes no further (it would answer the
// next question or move the player otherwise). Shift and the like alone
// don't count.
function closeOnKey(e) {
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  closeHeldAsk();
}

// Hides the ask screen and CHARGE.SYS and COMMAND.SYS.
export function closeMapPanels() {
  hideCharger();
  hideConsole();
  showAsk(false);
}
