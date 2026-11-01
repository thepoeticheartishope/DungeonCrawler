// The player's controls (moved out of main.js, tech-debt item 4e): a tap
// on the map, aiming and sweeping the light, looking up, the d-pad and the
// move keys, free walking every frame with One stick (walkFrame, settleMove),
// a step in turns (movePlayer), sneaking, SELECT's press and hold, the look
// and walk sticks, and the keyboard. Like devpanel.js it looks up its own
// elements and gets the main.js actions it calls passed in (initControls,
// which also wires every button and key and starts the walking frame).

import { state } from './state.js';
import { tutorialSteady } from './tutorial.js';
import { syncBattleScreen } from './battlescreen.js';
import {
  gunReady, nextGunTarget, openNameBarrel, openRelay, openReload, pressSelect, releaseSelect, steadyOn, openJob,
} from './gunactions.js';
import {
  REALTIME_WALK_MS, LOOK_POINTER_DEAD, LOOK_STICK_KNOB_PX, LOOK_UP_STICK, LOOK_SWEEP_SPEED, ONE_STICK,
} from './config.js';
import { stepPlayer, onStairs } from './moves.js';
import { requestMapDraw } from './mapview.js';
import { pickTarget, steadying, tickSteady, cancelSteady } from './gun.js';
import { mapPanelShown } from './gunpanels.js';
import { t } from './text.js';
import { initDpad, initLookStick, initWalkStick, SCREEN_WAYS, padWay, sweepHold } from './dpad.js';
import { lookUp } from './roomsky.js';
import { repeatMs, noteStep, heldStepReady } from './walkpace.js';
import { aimLook, turnBody, sweepLook, wantsTurn, waysInUse } from './look.js';
import { FACING_VECTORS } from './sight.js';
import { walkFree, freeSpot, resetWalk, switchSneak } from './walk.js';

const roomScreen = document.getElementById('roomScreen');
const answerInput = document.getElementById('answerInput');
const mcOptionsEl = document.getElementById('mcOptions');
const dpadButtons = {
  ...Object.fromEntries(Object.keys(SCREEN_WAYS).map(way => [way, document.getElementById('btn' + way)])),
  Skip: document.getElementById('btnSkip'),
};
const lookStick = dpadButtons.Skip; // the d-pad's centre: the look stick (dpad.js initLookStick)
const btnSelect = document.getElementById('btnSelect');
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The main.js actions these call, passed in by initControls.
let applyTurnOutcome, clockMayRun, drawEvents, goDown, leaveStation, leaveTutorial, openCharger, openConsole,
  openExchange, realTimeOn, showRoomNote, skipTurn, switchLight, worldFrame;

// A tap on the map. It picks the gun's
// target: the light swings to the minion on that tile and the target
// follows it, or a note says why it can't be shot. Costs no turn. Only SELECT
// fires (Timothy: tap, then SELECT), so a tap can never shoot by accident.
// A mouse click on anything else turns the body when the aim is past the
// free arc (free look plan); a tap on a phone never turns, so a stray tap
// can't spend a turn. A tap off a minion aims the light at the floor
// `point` under it instead,
// keeping the target (a mouse click past the arc then turns, as above).
export function tapMap(tile, pointerType, point) {
  const minion = state.floor.minions.some(m => m.row === tile.row && m.col === tile.col);
  if (!minion && point) {
    aimAtPoint(point);
    if (pointerType === 'mouse' && wantsTurn()) turnLook();
    return;
  }
  if (!minion && pointerType === 'mouse' && wantsTurn()) { turnLook(); return; }
  if (!gunReady()) return;
  const note = drawEvents(pickTarget(tile));
  if (note.text) showRoomNote(note.cls, note.text);
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

// Turns the body toward an aim past the free arc (look.js turnBody): a
// spent turn, so the minions get a move.
function turnLook() {
  if (!wantsTurn() || state.run.turnLocked || state.run.runEnded || mapPanelShown()) return;
  state.run.turnLocked = true;
  applyTurnOutcome(turnBody());
  state.run.turnLocked = false;
}

// The controls (room view plan step A: the camera never turns). Every
// d-pad arrow, key (arrows, W A S D, Q / E / Z / C for the corners) and
// number pad key walks the way it points on screen (dpad.js padWay); the
// light is aimed by the look stick and taps. Returns the ms until a held
// press acts again, or null to stop.
function padPush(sx, sy) {
  if (!roomScreen.classList.contains('show') || state.run.runEnded) return null;
  const way = padWay(sx, sy, waysInUse());
  if (!way) return null;
  const [dr, dc] = FACING_VECTORS[way];
  movePlayer(dr, dc);
  return repeatMs(dr, dc);
}

// Sweeps the light (look.js sweepLook): free inside the arc; a body turn
// past it is a spent turn, so the minions get a move.
function lightSweep(delta) {
  if (!lookReady()) return;
  const events = sweepLook(delta);
  if (!events.some(e => e.type === 'bodyTurned')) {
    drawEvents(events);
    return;
  }
  state.run.turnLocked = true;
  applyTurnOutcome(events);
  state.run.turnLocked = false;
}
const sweep = sweepHold(lightSweep, { speed: LOOK_SWEEP_SPEED });

// The look stick pushed sideways: sweeps faster the further it goes.
function stickSweep(dx) {
  sweep.push('stick', Math.max(-1, Math.min(1, dx / LOOK_STICK_KNOB_PX)));
}

// Looking up at the sky (sky eye plan; the room view's step F): Space held
// or the look stick pushed up, either one ('key' / 'stick'). Free and
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

// The look stick: pushed up past LOOK_UP_STICK of its reach, more up than
// sideways, it looks up and stops sweeping; otherwise it sweeps by its
// sideways push.
function stickPush(dx, dy) {
  const up = -dy > Math.abs(dx) && -dy / LOOK_STICK_KNOB_PX >= LOOK_UP_STICK;
  holdLookUp('stick', up);
  stickSweep(up ? 0 : dx);
}

// The keys by the d-pad way they stand for. A held key steps again once
// the last step has landed (walkpace.js).
const MOVE_KEYS = {
  ArrowUp: 'U', w: 'U', W: 'U', ArrowDown: 'D', s: 'D', S: 'D',
  ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R',
  q: 'UL', Q: 'UL', e: 'UR', E: 'UR', z: 'DL', Z: 'DL', c: 'DR', C: 'DR',
};
function moveKey(way, repeat) {
  if (repeat && !heldStepReady(performance.now())) return;
  padPush(...SCREEN_WAYS[way]);
}

// The look stick lights up while a tap would turn the body, and its label
// says what a tap does.
export function syncLookStick() {
  const armed = wantsTurn();
  lookStick.classList.toggle('armed', armed);
  lookStick.setAttribute('aria-label', t(armed ? 'dpad.stick.turn' : 'dpad.stick.wait'));
}

// When the player last took a step, for Real time's REALTIME_WALK_MS.
// View-side timing, so a module var rather than state.
let lastWalkAt = -Infinity;

// The move keys held down with One stick on (one stick plan step A), by
// d-pad way: free walking goes the way they add up to. The round stick's
// push instead while a finger is on it (step B): [x, y], or null.
const heldWays = new Set();
let stickPushed = null;
const walkStick = document.getElementById('walkStick');
const dpadClip = document.getElementById('dpadClip');
// When the last walking frame ran, for its length.
let walkFrameAt = null;

// One frame of free walking with One stick on (walk.js walkFree): while
// the real-time clock may run and nothing holds the player, the round
// stick's push or the held keys move them and swing their light round; a
// new tile or a bump settles like a step (settleMove). While the walk
// can't run, held keys and the stick's push are forgotten, so a key held
// through a panel doesn't walk on (or bump the same chest again) once it
// closes. The round stick stands in for the d-pad while One stick is on.
function walkFrame(now) {
  requestAnimationFrame(walkFrame);
  const dt = walkFrameAt === null ? 0 : now - walkFrameAt;
  walkFrameAt = now;
  const one = state.settings.oneStick;
  if (walkStick.hidden === one) {
    walkStick.hidden = !one;
    dpadClip.hidden = one;
  }
  if (!one) return;
  // Steadying a shot (steady aim): the player stands still, the aim
  // steadies and the world goes on.
  // A panel over the map (a Struggle, CHARGE.SYS) or a hit takes the aim
  // away: nothing is spent.
  if (steadying() && mapPanelShown()) cancelSteady();
  if (steadying()) {
    heldWays.clear();
    stickPushed = null;
    resetWalk();
    if (!clockMayRun() || state.run.turnLocked) return;
    const ticked = tickSteady(Math.min(dt, ONE_STICK.frameMs));
    const note = drawEvents(ticked.concat(tutorialSteady(ticked)));
    if (note.text) showRoomNote(note.cls, note.text);
    requestMapDraw();
    const hearts = state.run.hearts;
    worldFrame(dt);
    if (state.run.hearts < hearts && steadying()) {
      cancelSteady();
      selectHold = null;
      showRoomNote('warn-msg', t('gun.steady.knocked'));
    }
    return;
  }
  if (!clockMayRun() || state.run.turnLocked || walkHeld()) {
    heldWays.clear();
    stickPushed = null;
    resetWalk();
    // On the ship the world keeps running with POWER.SYS open: a Shaken
    // crew's wires slip at the board (ship.js shipFrame).
    // There are no stick men there for the world's frame to move.
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

// Sneaking on or off (X, One stick only; walk.js switchSneak).
function toggleSneak() {
  if (!state.settings.oneStick || !roomScreen.classList.contains('show') || mapPanelShown() || state.run.runEnded) return;
  const note = drawEvents(switchSneak());
  showRoomNote(note.cls, note.text);
}

// A move key went down or up with One stick on: it joins or leaves the
// held ways.
function holdWay(way, down) {
  if (down) heldWays.add(way);
  else heldWays.delete(way);
}

// One arrow press (stepPlayer in moves.js). A step or a first look in a
// box spends a turn; a step onto the stairs only asks (goDown takes them); a trapped box or the
// chest opens the battle screen; an energy cell opens the
// reload panel (its answer is the turn); walking into a downed stick man
// finishes it, a turn like a step; hiding in a room spot, coming out and
// pushing over a takedown and setting off a lure are turns too; a turn to a new direction or a
// bump only draws, except that with free look a bump that turned the body
// is a turn (bodyTurned). With Real time
// on, a press too soon after the last step is ignored (REALTIME_WALK_MS).
function movePlayer(dRow, dCol) {
  if (state.run.turnLocked || state.run.runEnded || walkHeld()) return;
  if (realTimeOn() && performance.now() - lastWalkAt < REALTIME_WALK_MS) return;
  state.run.turnLocked = true;
  const events = stepPlayer(dRow, dCol);
  if (events.some(e => e.type === 'stepped')) {
    lastWalkAt = performance.now();
    noteStep(dRow, dCol, lastWalkAt);
  }
  settleMove(events);
}

// What the player's move (a step, or free walking's new tile or bump)
// leads to, with the turn locked by the caller: a spent turn plays out
// (applyTurnOutcome), else its events are drawn; then any panel or
// screen it asks for opens.
function settleMove(events) {
  const has = (type) => events.some(e => e.type === type);
  if (has('stepped') || has('propSearched') || has('bodyTurned') || has('minionFinished') || has('hid') || has('hideLeft') || has('toppled') || has('lureSounded')) {
    applyTurnOutcome(events);
  } else {
    const note = drawEvents(events);
    if (note.text) showRoomNote(note.cls, note.text);
    if (has('boxSprung') || has('itemReached') || has('gateReached')) syncBattleScreen();
    if (has('exchangeOpened')) openExchange();
  }
  state.run.turnLocked = false;
  const cell = events.find(e => e.type === 'cellFound');
  if (cell) openReload(false, cell.prop);
  const relay = events.find(e => e.type === 'relayFound');
  if (relay) openRelay(relay.prop);
  // A crew member's job (roles.js; crew roles plan): its rounds on the ask screen.
  const job = events.find(e => e.type === 'jobStarted');
  if (job) openJob(job.role);
  if (has('nameAsked')) openNameBarrel();
  const left = events.find(e => e.type === 'tutorialLeft');
  if (left) leaveTutorial(left.advanced);
  if (has('stationLeft')) leaveStation();
  const charger = events.find(e => e.type === 'chargerOpened');
  if (charger) openCharger(charger.charger);
  const station = events.find(e => e.type === 'stationOpened');
  if (station) openCharger(station.station);
  // The ship's console: COMMAND.SYS's roles to learn (crew roles plan step B).
  const console = events.find(e => e.type === 'consoleOpened');
  if (console) openConsole(console.station);
}

// Whether walking and waiting are held: the Struggle dial is the
// player's move, CHARGE.SYS's wires are (its turns are spent there),
// COMMAND.SYS's pick is (the ship's console), and the record book read from
// the map has the map's place.
export function walkHeld() {
  const shown = mapPanelShown();
  return shown === 'struggle' || shown === 'charger' || shown === 'console' || shown === 'book';
}

// Hands over the main.js actions, then wires SELECT, the d-pad, the look
// and walk sticks and the keys, and starts the walking frame. main.js calls
// it once at load, where these used to be set up.
export function initControls(actions) {
  ({
    applyTurnOutcome, clockMayRun, drawEvents, goDown, leaveStation, leaveTutorial, openCharger, openConsole,
    openExchange, realTimeOn, showRoomNote, skipTurn, switchLight, worldFrame,
  } = actions);
  window.addEventListener('blur', () => sweep.reset());
  requestAnimationFrame(walkFrame);

  // SELECT acts the moment a finger or mouse goes down, not on the click
  // that comes when it lifts: a tap is held for about a tenth of a second,
  // and on release the dial's marker had already moved on (Timothy
  // felt the lag). The click a press ends with is skipped; a click with no
  // pointer behind it (Enter or Space on the focused button) still counts,
  // the same way the d-pad does it.
  let selectPressed = false;
  // Steady aim: the press being held, and whether it has slid off SELECT
  // (letting go there lowers the gun instead of firing).
  let selectHold = null;
  const SELECT_SLIDE_OFF_PX = 14;
  btnSelect.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || btnSelect.disabled) return;
    e.preventDefault();
    selectPressed = true;
    pressSelect();
    if (!steadying()) return;
    try { btnSelect.setPointerCapture(e.pointerId); } catch (_) { /* fine without */ }
    selectHold = { off: false };
  });
  btnSelect.addEventListener('pointermove', (e) => {
    if (!selectHold) return;
    const r = btnSelect.getBoundingClientRect(), pad = SELECT_SLIDE_OFF_PX;
    selectHold.off = e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad;
  });
  const letGoSelect = (e) => {
    if (!selectHold) return;
    const off = selectHold.off || e.type === 'pointercancel';
    selectHold = null;
    releaseSelect(off);
  };
  btnSelect.addEventListener('pointerup', letGoSelect);
  btnSelect.addEventListener('pointercancel', letGoSelect);
  btnSelect.addEventListener('click', () => {
    if (selectPressed) { selectPressed = false; return; }
    pressSelect();
  });
  btnSelect.addEventListener('keydown', () => { selectPressed = false; });
  btnSelect.addEventListener('contextmenu', (e) => e.preventDefault());

  initDpad({
    buttons: dpadButtons,
    canWalk: () => roomScreen.classList.contains('show') && !state.run.runEnded,
    push: padPush,
  });
  initLookStick({
    button: lookStick,
    // The stick sweeps the light, faster the further it is pushed sideways,
    // or looks up when pushed up.
    aim: stickPush,
    done: () => {
      sweep.release('stick');
      holdLookUp('stick', false);
    },
    wait: skipTurn,
    // A tap that does nothing says what the stick does.
    tap: () => showRoomNote('move-msg', t('room.stickTap')),
    turn: turnLook,
    wantsTurn,
  });

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
    if ((e.key === 'f' || e.key === 'F') && !selectHold) releaseSelect();
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
  // screen (moveKey, padPush), unless a question on the map is taking number keys. Space held looks up at the
  // sky (sky eye plan step A). With the gun on: F is SELECT (fires), T picks
  // the next target, . waits. V switches the light (light battery plan).
  // With One stick on, the move keys are held (walkFrame), X switches
  // sneaking and U held looks up as Space does.
  // On the stairs, Enter goes down (so does SELECT).
  // Letter and number keys answer a question on the ask screen, unless the
  // gun panels already used the key (picking a reload with 1-3, or F / Space
  // stopping the dial).
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === answerInput || e.defaultPrevented) return;
    if (!roomScreen.classList.contains('show')) return;
    if (e.key === 'Escape' && steadying()) { e.preventDefault(); releaseSelect(true); return; }
    const numpad = NUMPAD_WAYS[e.code];
    // One stick: the move keys are held, not pressed (walkFrame).
    const held = state.settings.oneStick && !mapPanelShown() && (MOVE_KEYS[e.key] || numpad);
    if (held) { e.preventDefault(); holdWay(held, true); return; }
    // A held number pad key steps again only once its last step has landed
    // (walkpace.js), not at the keyboard's own repeat rate.
    if (e.repeat && numpad && !heldStepReady(performance.now())) { e.preventDefault(); return; }
    const way = !mapPanelShown() && MOVE_KEYS[e.key];
    if (way) { e.preventDefault(); moveKey(way, e.repeat); return; }
    if (numpad && !mapPanelShown()) { e.preventDefault(); padPush(...SCREEN_WAYS[numpad]); }
    else if (e.key === 'Enter' && onStairs() && !mapPanelShown()) { e.preventDefault(); goDown(); }
    else if (e.key === ' ' && !mapPanelShown()) { e.preventDefault(); holdLookUp('key', true); }
    else if (gunReady() && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); if (!(e.repeat && steadyOn())) pressSelect(); }
    else if (gunReady() && (e.key === 't' || e.key === 'T')) { e.preventDefault(); nextGunTarget(); }
    else if (gunReady() && e.key === '.') { e.preventDefault(); skipTurn(); }
    else if (e.key === 'v' || e.key === 'V') { e.preventDefault(); switchLight(); }
    else if (state.settings.oneStick && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); toggleSneak(); }
    else if (state.settings.oneStick && (e.key === 'u' || e.key === 'U') && !mapPanelShown()) { e.preventDefault(); holdLookUp('u', true); }
    else if (mapPanelShown() === 'question' && state.settings.mcMode && ['1', '2', '3', '4', 'a', 'A', 'b', 'B', 'c', 'C', 'd', 'D'].includes(e.key)) {
      const idxMap = { 1: 0, a: 0, 2: 1, b: 1, 3: 2, c: 2, 4: 3, d: 3 };
      const idx = idxMap[e.key.toLowerCase()];
      const btn = mcOptionsEl.children[idx];
      if (btn && !btn.disabled) btn.click();
    }
  });
}
