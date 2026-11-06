// DOM rendering around the map: screens, the edge glow,
// and the HUD (hearts / the ship's crew and panic / timer). The map
// itself is drawn on a canvas by mapview.js.
//
// Call initRender(elements) once, from main.js, before using anything else
// here — it stores the DOM references every other function needs instead
// of each one threading them through as parameters.

import { state } from './state.js';
import { SENSE_NOTE_MS } from './config.js';
import { taughtCount } from './roles.js';
import { t } from './text.js';

let els = {};

export function initRender(elements) {
  els = elements;
}

// When a whisper fades (view-only timing, so a module var, not state).
let senseFadeTimer = null;

// Shows `text` over the map for `ms`, then lets it fade. `tone` 'dread' is the dungeon's faint voice; 'kind' is the
// warmer one that is on the player's side (the tutorial's lines). A line
// held longer than "I see you." also fades out slower ('slow').
export function showWhisper(text, tone = 'dread', ms = SENSE_NOTE_MS) {
  els.senseNote.textContent = text;
  els.senseNote.classList.toggle('kind', tone === 'kind');
  els.senseNote.classList.toggle('slow', ms > SENSE_NOTE_MS);
  els.senseNote.classList.add('show');
  clearTimeout(senseFadeTimer);
  senseFadeTimer = setTimeout(() => els.senseNote.classList.remove('show'), ms);
}

// Takes a whisper off the map at once (a new floor: a line from the last
// one, an advanced tutorial station's say, doesn't carry over).
export function hideWhisper() {
  clearTimeout(senseFadeTimer);
  // No fade: it goes with the floor it was said on.
  els.senseNote.style.transition = 'none';
  els.senseNote.classList.remove('show', 'slow');
  void els.senseNote.offsetWidth;
  els.senseNote.style.transition = '';
}

export function showScreen(el) {
  [els.startScreen, els.shipIntroScreen, els.roomScreen, els.winScreen, els.loseScreen]
    .forEach(s => s.classList.remove('show'));
  el.classList.add('show');
  // Hearts/coins/turn/room/timer are meaningless before a run starts (and
  // during the ship's opening, before the timer even
  // starts), so the header only shows them once the player has actually
  // reached a room.
  els.statsEl.classList.toggle('show', ![els.startScreen, els.shipIntroScreen].includes(el));
}

// Status bar numbers: hearts, gold and turn count, then the ship's.
// Call after any change to them.
export function renderHud() {
  // ASCII rather than hearts: the terminal face has no symbol glyphs.
  els.heartsEl.textContent = Math.max(state.run.hearts, 0) + '/' + state.run.maxHearts;
  els.coinsTotalEl.textContent = state.run.coinsTotal;
  els.turnCountEl.textContent = state.run.turnCount;
  // A walk isn't a turn: the HUD's time says it instead.
  els.turnCountEl.parentElement.hidden = true;
  renderShipHud();
}

// The ship's HUD (ship plan step C, ship.js; no arrival clock since
// Timothy 2026-10-31; no burns since step G1): crew taught of the roles on
// duty, and the crew's panic by name and as a meter. The rest of the HUD
// hides there (CSS .ship-hud). main.js worldFrame calls it each frame.
export function renderShipHud() {
  const ship = state.floor.ship ? state.run.ship : null;
  els.statsEl.classList.toggle('ship-hud', !!ship);
  if (!ship) return;
  // Crew taught of the roles on duty (crew roles plan step C).
  const crew = taughtCount();
  els.shipTaught.textContent = crew.taught + '/' + crew.of;
  els.shipPanic.textContent = t('panic.' + ship.panic);
  [...els.shipPanicMeter.children].forEach((cell, i) => cell.classList.toggle('on', i < ship.panic));
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

let timerHandle = null;

export function stopTimer() {
  clearInterval(timerHandle);
  timerHandle = null;
}

export function startTimer() {
  stopTimer();
  state.run.seconds = 0;
  els.timerEl.textContent = formatTime(0);
  timerHandle = setInterval(() => {
    state.run.seconds++;
    els.timerEl.textContent = formatTime(state.run.seconds);
  }, 1000);
}
