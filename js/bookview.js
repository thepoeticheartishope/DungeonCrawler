// The record book (record book plan, ideas/record-book-plan.md outside the
// repo): the ask screen (#askScreen) drawn as a slate book with a ringed
// spine, a dark page, and on its left edge the light tube (tubeart.js)
// showing the battery. Step D: tabs on its right edge, ASK, LOG and MAP,
// turn its pages (pageturn.js). LOG is the whole room log, newest first;
// MAP is the minimap (minimapview.js draws into the page's canvas). The
// LOG and MAP buttons (and L / M) open the book at that tab from the map:
// the clock keeps running then (open call 1, Timothy's go), and a stick
// man reaching the player closes it (main.js). gunpanels.js calls
// bookAsks() whenever the ask screen opens or closes, and refreshBook().
// Reads state only.

import { state } from './state.js';
import { LIGHT_BATTERY_MAX } from './config.js';
import { batteryInPlay } from './battery.js';
import { drawTube, TUBE_W, TUBE_H } from './tubeart.js';
import { turnPage, pageTurning } from './pageturn.js';
import { refreshMinimap } from './minimapview.js';
import { t } from './text.js';
import { teachTargets } from './roles.js';

// The tabs, top to bottom: one further down turns the page forward.
const TABS = ['ask', 'log', 'map'];

const els = {
  room: document.getElementById('roomScreen'),
  book: document.getElementById('askScreen'),
  title: document.getElementById('askTitle'),
  tabTitle: document.getElementById('bookTabTitle'),
  clock: document.getElementById('bookClock'),
  strip: document.getElementById('bookStrip'),
  tube: document.getElementById('bookTube'),
  readout: document.getElementById('bookReadout'),
  page: document.getElementById('bookPage'),
  tabs: document.getElementById('bookTabs'),
  readClose: document.getElementById('bookReadClose'),
  roomFeedback: document.getElementById('roomFeedback'),
  logLines: document.getElementById('bookLogLines'),
  mapFoot: document.getElementById('bookMapFoot'),
  sections: {
    ask: document.getElementById('bookAsk'),
    log: document.getElementById('bookLog'),
    map: document.getElementById('bookMap'),
  },
};
els.tube.width = TUBE_W;
els.tube.height = TUBE_H;
const tubeCtx = els.tube.getContext('2d');

// The page showing: 'ask', 'log' or 'map'. View-only, so not in state.
let tab = 'ask';
// Whether the book is open from the map for LOG or MAP (no question).
let reading = false;
// What main.js passes in (initBook).
let deps = {};

// Hooks up the tabs, the LOG and MAP buttons, the taps that close the
// book and its keys. `deps`: askHeld() (an answer waiting for its tap,
// gunpanels.js) and mapPanelShown() (another panel over the map). Call
// once, from main.js.
export function initBook({ askHeld, mapPanelShown }) {
  deps = { askHeld, mapPanelShown };
  els.tabs.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', (e) => {
    // Not a tap on the book: a held answer stays held.
    e.stopPropagation();
    pickTab(btn.dataset.tab);
  }));
  document.getElementById('btnLog').addEventListener('click', () => openBook('log'));
  document.getElementById('btnMinimap').addEventListener('click', () => openBook('map'));
  // Read from the map, a tap anywhere on the book but its tabs closes it,
  // as a tap on the old log and minimap did.
  els.book.addEventListener('click', () => { if (reading && !pageTurning()) closeBook(); });
  addEventListener('keydown', bookKey, true);
}

// Whether the book is open from the map for LOG or MAP. The clock runs
// then (main.js worldRunsUnder), but the player can't move.
export function bookReading() {
  return reading;
}

// The page the book shows: 'ask', 'log' or 'map'.
export function bookTab() {
  return tab;
}

// The ask screen opened (`asking` true) or closed (gunpanels.js
// showOnly). Either way a book read from the map is done, and the page
// is back at ASK.
export function bookAsks(asking) {
  if (reading) {
    reading = false;
    els.room.classList.remove('reading');
  }
  if (tab !== 'ask') showTab('ask');
  els.tabs.querySelector('[data-tab="ask"]').hidden = !asking;
}

// Opens the book at `which` ('log' or 'map'): from the map, the book in
// the map's place with the clock running; with a question open, a turn to
// that page. Not while another panel (the dial, CHARGE.SYS) is over the
// map.
export function openBook(which) {
  if (!els.book.hidden) { pickTab(which); return; }
  if (!els.room.classList.contains('show') || deps.mapPanelShown()) return;
  reading = true;
  els.tabs.querySelector('[data-tab="ask"]').hidden = true;
  els.book.hidden = false;
  els.room.classList.add('reading');
  showTab(which);
  refreshBook();
}

// Closes a book read from the map (L / M again, Esc, a tap, a stick man
// reaching the player). With a question open it turns back to ASK.
export function closeBook() {
  if (!reading) { if (tab !== 'ask') pickTab('ask'); return; }
  reading = false;
  els.book.hidden = true;
  els.room.classList.remove('reading');
  showTab('ask');
}

// Turns to `which`, forward if its tab is further down, back if further
// up. The same tab again closes a book read from the map.
function pickTab(which) {
  if (which === tab) { if (reading) closeBook(); return; }
  if (which === 'ask' && reading) return;
  const dir = TABS.indexOf(which) > TABS.indexOf(tab) ? 1 : -1;
  turnPage(els.page, () => showTab(which), dir);
}

// Puts `which` on the page: its section, its name on the top strip and
// its tab marked. Leaving ASK takes the keyboard off its answer box, so L
// and M stay the book's keys.
function showTab(which) {
  tab = which;
  Object.entries(els.sections).forEach(([id, el]) => { el.hidden = id !== which; });
  els.tabs.querySelectorAll('[data-tab]').forEach(btn => {
    const on = btn.dataset.tab === which;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', String(on));
  });
  els.title.hidden = which !== 'ask';
  els.tabTitle.hidden = which === 'ask';
  els.tabTitle.textContent = which === 'ask' ? '' : t('book.title.' + which);
  els.readClose.hidden = !reading;
  if (which !== 'ask' && els.book.contains(document.activeElement)) document.activeElement.blur();
  els.page.scrollTop = 0;
  if (which === 'log') refreshBookLog();
  if (which === 'map') {
    // On the ship, a line for the rings round crew waiting to be taught.
    const teach = teachTargets().length > 0;
    els.mapFoot.textContent = [state.settings.fogEnabled ? t('book.map.dashed') : '', teach ? t('book.map.teach') : ''].filter(Boolean).join(' ');
    els.mapFoot.hidden = !state.floor.plan || (!state.settings.fogEnabled && !teach);
    refreshMinimap();
  }
}

// Turns back to ASK if another page shows (gunpanels.js, before an
// answer is held: the Timer can run out while the player reads the log).
export function showAskTab() {
  if (tab !== 'ask') showTab('ask');
}

// Redraws the book from state: its paper, the clock's word and the tube.
// The tube's strip is hidden while the battery is out of play (Comfort
// mode, DEV), as the HUD's battery is, and before the first floor (DEV ->
// Book paper). Read from the map, the clock runs, so main.js calls this
// on each of its polls.
export function refreshBook() {
  els.book.dataset.paper = state.settings.bookPaper;
  els.clock.textContent = t(reading ? 'book.running' : 'book.paused');
  // No clock on the ship (Timothy 2026-10-31: no timers there).
  els.clock.hidden = Boolean(state.floor && state.floor.ship);
  const inPlay = batteryInPlay() && Boolean(state.floor.light);
  els.strip.hidden = !inPlay;
  if (!inPlay) return;
  const light = state.floor.light;
  drawTube(tubeCtx, { charge: light.charge, max: LIGHT_BATTERY_MAX, lit: light.on });
  const left = Math.ceil(light.charge);
  els.readout.textContent = light.locked
    ? t('book.empty')
    : '#'.repeat(left) + '-'.repeat(Math.max(LIGHT_BATTERY_MAX - left, 0));
}

// The LOG page: the room log's notes (main.js showRoomNote keeps them in
// #roomFeedback, oldest first), newest first, one to a rule. main.js
// calls it after each new note, so an open log keeps up.
export function refreshBookLog() {
  if (tab !== 'log' || els.book.hidden) return;
  const notes = [...els.roomFeedback.children].reverse();
  els.logLines.replaceChildren(...notes.map(note => {
    const line = note.cloneNode(true);
    line.classList.remove('note-old');
    line.classList.add('book-log-line');
    return line;
  }));
  if (!notes.length) els.logLines.textContent = t('book.log.empty');
}

// The book's keys, before anyone else's: L and M open it at LOG or MAP
// (or close it on the same page), Esc closes it or turns back to ASK.
// Read from the map, every other key waits; with a question open on
// another page, so do its answer keys. Not while typing an answer, a page
// is turning, or an answer waits for its tap (any key closes that).
function bookKey(e) {
  if (!els.room.classList.contains('show') || pageTurning() || deps.askHeld()) return;
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
  const open = !els.book.hidden;
  const which = { l: 'log', m: 'map' }[e.key.toLowerCase()];
  if (which) {
    if (!open && deps.mapPanelShown()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (open && tab === which) closeBook();
    else openBook(which);
    return;
  }
  if (!open || (!reading && tab === 'ask')) return;
  if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('#bookTabs')) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.key === 'Escape') closeBook();
}
