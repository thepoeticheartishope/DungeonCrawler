// The player's controls (moved out of main.js, tech-debt item 4e): a tap
// on the map aims the light, looking up, the move keys, free walking every
// frame (walkFrame, settleMove), sneaking, the walk stick, and the
// keyboard. Like devpanel.js it looks up its own
// elements and gets the main.js actions it calls passed in (initControls,
// which also wires every button and key and starts the walking frame).

import { state } from './state.js';

import { openJob } from './gunactions.js';
import { LOOK_POINTER_DEAD } from './config.js';
import { requestMapDraw } from './mapview.js';
import { mapPanelShown } from './gunpanels.js';
import { t } from './text.js';
import { initWalkStick, SCREEN_WAYS } from './dpad.js';
import { lookUp } from './roomsky.js';
import { aimLook } from './look.js';
import { walkFree, freeSpot, resetWalk, switchSneak } from './walk.js';

const roomScreen = document.getElementById('roomScreen');
const answerInput = document.getElementById('answerInput');
const mcOptionsEl = document.getElementById('mcOptions');
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The main.js actions these call, passed in by initControls.
let applyTurnOutcome, clockMayRun, drawEvents, openCharger, openConsole,
  showRoomNote, worldFrame;

// A tap on the map aims the light at the floor `point` under it.
export function tapMap(tile, pointerType, point) {
  if (point) aimAtPoint(point);
}

// Whether the player can aim right now: the room screen up with no panel
// over it, and no turn in progress. Aiming is free, so the
// real-time clock doesn't matter.
function lookReady() {
  return roomScreen.classList.contains('show') && !mapPanelShown() &&
    !state.run.turnLocked && !state.run.runEnded;
}

// Aims the light at `angle` (look.js aimLook) and draws the result. No turn.
function aimTo(angle) {
  if (!lookReady()) return;
  drawEvents(aimLook(angle));
}

// A tap on the floor: aims at the floor point under it, unless it's on
// the player's own tile, where the angle would jump about.
function aimAtPoint(point) {
  const dr = point.row - state.floor.playerRow;
  const dc = point.col - state.floor.playerCol;
  if (Math.hypot(dr, dc) < LOOK_POINTER_DEAD) return;
  aimTo(Math.atan2(dc, -dr));
}

// Looking up at the sky (sky eye plan; the room view's step F): Space or
// U held, or the walk stick held still ('key' / 'u' / 'stick'). Free and
// view-only (roomview.js lookUp): the world keeps its turns, and with
// Real time on it keeps moving while the player looks away from the floor.
const lookingUp = new Set();
function holdLookUp(source, on) {
  if (lookingUp.has(source) === on) return;
  if (on) lookingUp.add(source);
  else lookingUp.delete(source);
  lookUp(lookingUp.size > 0);
  requestMapDraw();
}

// The move keys by the screen way they stand for (dpad.js SCREEN_WAYS).
const MOVE_KEYS = {
  ArrowUp: 'U', w: 'U', W: 'U', ArrowDown: 'D', s: 'D', S: 'D',
  ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R',
  q: 'UL', Q: 'UL', e: 'UR', E: 'UR', z: 'DL', Z: 'DL', c: 'DR', C: 'DR',
};
// The move keys held down (one stick plan step A), by screen way: free walking goes the way they add up to. The round stick's
// push instead while a finger is on it (step B): [x, y], or null.
const heldWays = new Set();
let stickPushed = null;
const walkStick = document.getElementById('walkStick');
// When the last walking frame ran, for its length.
let walkFrameAt = null;

// One frame of free walking (walk.js walkFree): while
// the real-time clock may run and nothing holds the player, the round
// stick's push or the held keys move them and swing their light round; a
// new tile or a bump settles like a step (settleMove). While the walk
// can't run, held keys and the stick's push are forgotten, so a key held
// through a panel doesn't walk on (or bump the same chest again) once it
// closes.
function walkFrame(now) {
  requestAnimationFrame(walkFrame);
  const dt = walkFrameAt === null ? 0 : now - walkFrameAt;
  walkFrameAt = now;
  if (!clockMayRun() || state.run.turnLocked || walkHeld()) {
    heldWays.clear();
    stickPushed = null;
    resetWalk();
    // On the ship the world keeps running with POWER.SYS open (its HUD
    // follows); there are no stick men there for the world's frame to move.
    if (state.floor.ship && clockMayRun() && !state.run.turnLocked) worldFrame(dt);
    return;
  }
  const spot = freeSpot();
  const [x0, y0, look0] = [spot.x, spot.y, state.floor.look];
  let events;
  if (stickPushed) {
    const [x, y] = stickPushed;
    events = walkFree(x, y, { push: Math.min(1, Math.hypot(x, y)), dtMs: dt, still: reduceMotion });
  } else {
    const [x, y] = [...heldWays].reduce(([sx, sy], way) => [sx + SCREEN_WAYS[way][0], sy + SCREEN_WAYS[way][1]], [0, 0]);
    events = walkFree(x, y, { dtMs: dt, keys: true, still: reduceMotion });
  }
  if (spot.x !== x0 || spot.y !== y0 || state.floor.look !== look0) requestMapDraw();
  if (events.length) {
    state.run.turnLocked = true;
    settleMove(events);
  }
  worldFrame(dt);
}

// Sneaking on or off (X; walk.js switchSneak).
function toggleSneak() {
  if (!roomScreen.classList.contains('show') || mapPanelShown() || state.run.runEnded) return;
  const note = drawEvents(switchSneak());
  showRoomNote(note.cls, note.text);
}

// A move key went down or up: it joins or leaves the
// held ways.
function holdWay(way, down) {
  if (down) heldWays.add(way);
  else heldWays.delete(way);
}

// What the player's move (free walking's new tile or bump)
// leads to, with the turn locked by the caller: a spent turn plays out
// (applyTurnOutcome), else its events are drawn; then any panel or
// screen it asks for opens.
function settleMove(events) {
  const has = (type) => events.some(e => e.type === type);
  if (has('stepped') || has('bodyTurned')) {
    applyTurnOutcome(events);
  } else {
    const note = drawEvents(events);
    if (note.text) showRoomNote(note.cls, note.text);
  }
  state.run.turnLocked = false;

  // A crew member's job (roles.js; crew roles plan): its rounds on the ask screen.
  const job = events.find(e => e.type === 'jobStarted');
  if (job) openJob(job.role);

  const station = events.find(e => e.type === 'stationOpened');
  if (station) openCharger(station.station);
  // The ship's console: COMMAND.SYS's roles to learn (crew roles plan step B).
  const console = events.find(e => e.type === 'consoleOpened');
  if (console) openConsole(console.station);
}

// Whether walking and waiting are held: CHARGE.SYS's wires are (its turns are spent there),
// COMMAND.SYS's pick is (the ship's console), and the record book read from
// the map has the map's place.
function walkHeld() {
  const shown = mapPanelShown();
  return shown === 'charger' || shown === 'console' || shown === 'book';
}

// Hands over the main.js actions, then wires the walk stick and the keys, and starts the walking frame. main.js calls
// it once at load, where these used to be set up.
export function initControls(actions) {
  ({
    applyTurnOutcome, clockMayRun, drawEvents, openCharger, openConsole,
    showRoomNote, worldFrame,
  } = actions);
  requestAnimationFrame(walkFrame);

  walkStick.setAttribute('aria-label', t('dpad.walkStick'));
  initWalkStick({
    el: walkStick,
    push: (x, y) => { stickPushed = [x, y]; },
    release: () => { stickPushed = null; },
    lookUp: (on) => holdLookUp('stick', on),
    tap: () => showRoomNote('move-msg', t('room.walkStickTap')),
  });

  // The number pad's keys by the way they point (eight ways plan: 7 8 9 /
  // 4 6 / 1 2 3).
  const NUMPAD_WAYS = {
    Numpad7: 'UL', Numpad8: 'U', Numpad9: 'UR', Numpad4: 'L',
    Numpad6: 'R', Numpad1: 'DL', Numpad2: 'D', Numpad3: 'DR',
  };
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') holdLookUp('key', false);
    if (e.key === 'u' || e.key === 'U') holdLookUp('u', false);
    const way = MOVE_KEYS[e.key] || NUMPAD_WAYS[e.code];
    if (way) holdWay(way, false);
  });
  window.addEventListener('blur', () => {
    heldWays.clear();
    holdLookUp('key', false);
    holdLookUp('u', false);
    holdLookUp('stick', false);
  });

  // Keys on desktop, ignored while typing in the answer box. The arrows,
  // W A S D, Q / E / Z / C and the number pad walk the way they point on
  // screen, held down (walkFrame), unless a panel is up. Space or U held
  // looks up at the sky (sky eye plan step A). X switches sneaking.
  // Letter and number keys answer a question on the ask screen.
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === answerInput || e.defaultPrevented) return;
    if (!roomScreen.classList.contains('show')) return;
    const numpad = NUMPAD_WAYS[e.code];
    // The move keys are held, not pressed (walkFrame).
    const held = !mapPanelShown() && (MOVE_KEYS[e.key] || numpad);
    if (held) { e.preventDefault(); holdWay(held, true); return; }
    if (e.key === ' ' && !mapPanelShown()) { e.preventDefault(); holdLookUp('key', true); }
    else if (e.key === 'x' || e.key === 'X') { e.preventDefault(); toggleSneak(); }
    else if ((e.key === 'u' || e.key === 'U') && !mapPanelShown()) { e.preventDefault(); holdLookUp('u', true); }
    else if (mapPanelShown() === 'question' && state.settings.mcMode && ['1', '2', '3', '4', 'a', 'A', 'b', 'B', 'c', 'C', 'd', 'D'].includes(e.key)) {
      const idxMap = { 1: 0, a: 0, 2: 1, b: 1, 3: 2, c: 2, 4: 3, d: 3 };
      const idx = idxMap[e.key.toLowerCase()];
      const btn = mcOptionsEl.children[idx];
      if (btn && !btn.disabled) btn.click();
    }
  });
}
