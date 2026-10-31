// CHARGE.SYS, the charger's panel (charger plan step B, `ideas/charger-plan.md`
// outside the repo): a box of wires over the map, not on the ask screen, so
// the room, the static and anything coming stay in view. A tap on a wire
// turns it; arrows move between wires, Enter / Space (the focused button)
// or F turns one, Escape or LEAVE closes it (the wires stay). The rules are
// charger.js; main.js opens it and passes in what a turn and LEAVE do
// (turnWire, leave). This only draws and listens.

import { powered, openBreaker, N, E, S, W } from './charger.js';
import { CHARGER } from './config.js';
import { t } from './text.js';

const els = {};
let actions = {};
// The wires showing (the charger's puzzle; kept after a charge clears it
// from the charger, so the joined-up wires stay on screen until it closes).
let puzzle = null;
let realTime = false;
let focusIndex = 0;
let done = false;
// A ship station's mode ('train' / 'teach', stations.js), or null for the
// charger: it names the panel POWER.SYS and says what the wires are for.
let mode = null;

// Looks up the panel and hooks up its wires, LEAVE and keys. Call once, from main.js.
export function initChargerView({ turnWire, leave }) {
  actions = { turnWire, leave };
  els.panel = document.getElementById('chargerPanel');
  els.title = document.getElementById('chargerTitle');
  els.sub = document.getElementById('chargerSub');
  els.hint = document.getElementById('chargerHint');
  els.wires = document.getElementById('chargerWires');
  els.leave = document.getElementById('chargerLeave');
  els.leave.addEventListener('click', () => actions.leave());
  els.wires.addEventListener('click', (e) => {
    const btn = e.target.closest('.charger-wire');
    if (!btn || done) return;
    focusIndex = Number(btn.dataset.i);
    actions.turnWire(focusIndex);
  });
  document.addEventListener('keydown', (e) => {
    if (!chargerShown()) return;
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1] }[e.key];
    if (e.key === 'Escape') {
      e.preventDefault();
      actions.leave();
    } else if (step && puzzle) {
      e.preventDefault();
      const n = puzzle.n;
      const row = Math.floor(focusIndex / n) + step[0], col = focusIndex % n + step[1];
      if (row >= 0 && row < n && col >= 0 && col < n) {
        focusIndex = row * n + col;
        focusWire();
      }
    } else if ((e.key === 'f' || e.key === 'F') && !done) {
      e.preventDefault();
      actions.turnWire(focusIndex);
    }
  });
}

// Whether CHARGE.SYS is up.
export function chargerShown() {
  return !!els.panel && !els.panel.hidden;
}

// Opens CHARGE.SYS on `wires` (charger.js makeWires' shape), focus on the
// wire PWR feeds. With Real time on the clock is the cost, so it says so in
// place of the turns spent. `stationMode` ('train' / 'teach'): a ship
// station's wires (ship plan step B), named for what they are for.
export function showCharger(wires, isRealTime, stationMode = null) {
  puzzle = wires;
  realTime = isRealTime;
  mode = stationMode;
  done = false;
  focusIndex = wires.from * wires.n;
  els.title.textContent = t(mode ? 'station.title' : 'charger.title');
  els.panel.hidden = false;
  renderCharger(wires, false);
}

// Draws the wires again (after a turn). `charged`: power reached the cell,
// so the hint says so and the wires stop taking turns.
export function renderCharger(wires, charged) {
  puzzle = wires;
  done = charged;
  const { n } = wires;
  const power = powered(wires);
  els.wires.style.setProperty('--wires', n);
  let html = '';
  for (let row = 0; row < n; row++) {
    html += '<span class="charger-end lit">' + (row === wires.from ? t('charger.pwr') : '') + '</span>';
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      const on = power.on.has(i);
      // A breaker (ship stations): a box on its wire, open until a right
      // answer closes it.
      const breaker = (wires.breakers || []).includes(i);
      const open = breaker && openBreaker(wires, i);
      const where = { row: row + 1, col: col + 1 };
      const label = breaker ? t(open ? 'station.breaker' : 'station.breakerClosed', where)
        : t('charger.wire', where) + (on ? ', ' + t('charger.powered') : '');
      const cls = 'charger-wire' + (on ? ' on' : '') + (breaker ? ' breaker' : '') + (open ? ' open' : '');
      html += '<button type="button" class="' + cls + '" data-i="' + i + '" aria-label="' + label + '"' +
        (charged ? ' disabled' : '') + '>' + wireSvg(wires.wires[i], breaker) + '</button>';
    }
    html += '<span class="charger-end' + (power.done ? ' lit' : '') + '">' + (row === wires.to ? t('charger.cell') : '') + '</span>';
  }
  els.wires.innerHTML = html;
  if (mode) {
    els.sub.textContent = t('station.sub.' + mode);
    els.hint.textContent = t(charged ? 'station.done.' + mode : 'station.hint.' + mode);
  } else {
    els.sub.textContent = realTime ? t('charger.clock') : t('charger.turns', { turns: Math.floor(wires.turns / CHARGER.wireTurnsPerTurn) });
    els.hint.textContent = t(charged ? 'charger.charged' : 'charger.hint');
  }
  if (!charged) focusWire();
}

// Closes CHARGE.SYS (the wires stay on the charger as they were).
export function hideCharger() {
  if (!els.panel) return;
  els.panel.hidden = true;
  puzzle = null;
  done = false;
}

function focusWire() {
  const btn = els.wires.querySelector('[data-i="' + focusIndex + '"]');
  if (btn) btn.focus({ preventScroll: true });
}

// One wire as a small square drawing: a line from the middle to each side
// it reaches, a dot in the middle. Its colour is the button's (CSS). A
// breaker's middle is a bigger box instead (`breaker`), hollow while open.
function wireSvg(wire, breaker = false) {
  const ends = { [N]: [20, 0], [E]: [40, 20], [S]: [20, 40], [W]: [0, 20] };
  let lines = '';
  for (const side of [N, E, S, W]) {
    if (wire & side) lines += '<line x1="20" y1="20" x2="' + ends[side][0] + '" y2="' + ends[side][1] + '"/>';
  }
  const middle = breaker ? '<rect class="breaker-box" x="11" y="11" width="18" height="18"/>' : '<rect x="16" y="16" width="8" height="8"/>';
  return '<svg viewBox="0 0 40 40" aria-hidden="true">' + lines + middle + '</svg>';
}
