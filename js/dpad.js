// On-screen d-pad: hold an arrow to keep walking, the way a held arrow key
// does, so a touch player doesn't have to tap once per tile. Since the
// eight ways plan it is a square pad of 8 arrows; with DEV -> 8 ways off it
// is turned 45° with only its 4 edge arrows. The arrows mean ways round the
// body (shoulder view plan step B, shoulderStep), and left / right sweep
// the light (sweepHold). The centre is the look stick (free look plan step
// C): push it sideways to sweep, up to look up, tap it to turn or (twice)
// to wait. main.js passes in the buttons and the actions; this file only
// handles input.
import { DPAD_HOLD_DELAY_MS, DPAD_HOLD_REPEAT_MS, LOOK_STICK_DRAG_PX, LOOK_STICK_KNOB_PX, LOOK_STICK_TAP_MS, LOOK_STICK_HOLD_MS, LOOK_STICK_LIGHT_TAPS, SHOULDER_SWEEP_SPEED, SHOULDER_SWEEP_TAP } from './config.js';

// The pad's arrows by where they point on screen, as [x, y] (y down). The
// d-pad's buttons, the arrow keys and the number pad are named by these.
export const SCREEN_WAYS = {
  U: [0, -1], UR: [1, -1], R: [1, 0], DR: [1, 1],
  D: [0, 1], DL: [-1, 1], L: [-1, 0], UL: [-1, -1],
};

// The grid step [dRow, dCol] for a number pad key pointing (sx, sy), or
// null: the number pad walks by the map's ways, the minimap's diamond
// (grid north is up and to the right, so up is grid NW and up-right is
// grid N). With 8 ways off up is grid north, and a diagonal does nothing.
export function screenStep(sx, sy, eightWays) {
  if (!sx && !sy) return null;
  if (!eightWays) return sx && sy ? null : [sy, sx];
  return [Math.sign(sy - sx), Math.sign(sy + sx)];
}

// The ways clockwise from north, for turning round the body.
const CLOCKWISE = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// The way a push (sx, sy) on the d-pad or keys walks in the shoulder view,
// round the body's way `facing` among the ways in use (`ways`): up is
// straight ahead, down straight behind, up-left / up-right ahead at a
// slant (the next way round). Left and right sweep the light instead, and
// down-left / down-right do nothing: null.
export function shoulderStep(sx, sy, facing, ways) {
  const ring = CLOCKWISE.filter(way => ways.includes(way));
  const at = ring.indexOf(facing);
  const n = ring.length;
  if (at < 0 || sy === 0 || (sx && sy > 0)) return null;
  if (sy > 0) return ring[(at + n / 2) % n];
  return ring[(at + sx + n) % n];
}

// The shoulder view's sweep (shoulder view plan step B): while left or
// right is held (a key, a d-pad arrow) or the look stick is pushed
// sideways, the light sweeps round at SHOULDER_SWEEP_SPEED (radians a
// second). Each source holds its own push from -1 to 1 (anticlockwise to
// clockwise), the pushes add up, held between -1 and 1, and every
// animation frame calls `sweep(radians)` with how far to go since the last
// frame (`speed` may be a function, read each frame, for the Slower sweep
// setting). A press marked `tap` that ends before it has swept
// SHOULDER_SWEEP_TAP sweeps the rest at once, so a quick tap still moves
// the light. `frames` stands in for requestAnimationFrame in tests.
// Returns { push(source, amount, tap), release(source), reset() }.
export function sweepHold(sweep, {
  speed = SHOULDER_SWEEP_SPEED, tapMin = SHOULDER_SWEEP_TAP,
  frames = { request: fn => requestAnimationFrame(fn), cancel: id => cancelAnimationFrame(id) },
} = {}) {
  const pushes = new Map(); // source -> { amount, tap, swept }
  let frame = null;
  let last = null;
  const total = () => Math.max(-1, Math.min(1, [...pushes.values()].reduce((sum, p) => sum + p.amount, 0)));
  const tick = (now) => {
    frame = null;
    if (!pushes.size) { last = null; return; }
    const dt = last === null ? 0 : Math.min(50, now - last) / 1000;
    last = now;
    const delta = total() * (typeof speed === 'function' ? speed() : speed) * dt;
    if (delta) {
      pushes.forEach(p => { p.swept += delta; });
      sweep(delta);
    }
    frame = frames.request(tick);
  };
  const stop = () => {
    if (frame !== null) frames.cancel(frame);
    frame = null;
    last = null;
  };
  return {
    push(source, amount, tap = false) {
      const held = pushes.get(source);
      pushes.set(source, { amount, tap, swept: held ? held.swept : 0 });
      if (frame === null) frame = frames.request(tick);
    },
    release(source) {
      const held = pushes.get(source);
      if (!held) return;
      pushes.delete(source);
      const dir = Math.sign(held.amount);
      const left = tapMin - held.swept * dir;
      if (held.tap && dir && left > 0) sweep(dir * left);
      if (!pushes.size) stop();
    },
    reset() {
      pushes.clear();
      stop();
    },
  };
}

let holdTimer = null;

// Wires the d-pad's arrows (`buttons`, by SCREEN_WAYS name): they act on
// press and repeat while held. `push(sx, sy)` acts (a step round the body)
// and returns the ms until a held press acts again (walkpace.js: longer
// steps wait longer), or null to stop. The centre is wired by
// initLookStick. `canWalk()` says whether the room screen is taking moves
// right now; the repeat stops as soon as it isn't (a fight opened, the
// floor changed, the run ended). `hold(sx, sy, down)` may take an arrow as
// a hold instead (the sweep): it is called as the press starts (returning
// true when it took it) and again with `down` false when the press ends.
export function initDpad({ buttons, canWalk, push, hold = () => false }) {
  for (const [dir, [sx, sy]] of Object.entries(SCREEN_WAYS)) {
    const btn = buttons[dir];
    let pressed = false; // a pointer press already stepped; skip the click that follows it
    let holding = false; // this press is a hold (hold() took it)
    const endHold = () => {
      if (!holding) return;
      holding = false;
      hold(sx, sy, false);
    };
    // Acts on the press; the ms until a held press acts again, or null.
    const step = () => {
      if (btn.disabled || !canWalk()) { stopHold(); return null; }
      const next = push(sx, sy);
      if (next === null) stopHold();
      return next;
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); // no text selection or focus ring from a held finger
      pressed = true;
      stopHold();
      endHold();
      if (!btn.disabled && canWalk() && hold(sx, sy, true)) {
        holding = true;
        return;
      }
      step();
      holdTimer = setTimeout(function repeat() {
        const next = step();
        if (holdTimer !== null) holdTimer = setTimeout(repeat, next ?? DPAD_HOLD_REPEAT_MS);
      }, DPAD_HOLD_DELAY_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => btn.addEventListener(type, () => {
      stopHold();
      endHold();
    }));
    // A click with no pointer behind it (Enter or Space on a focused button)
    // still takes one step. The click a mouse or touch press ends with is
    // skipped, since that press already stepped on pointerdown.
    btn.addEventListener('click', () => {
      if (pressed) { pressed = false; return; }
      if (canWalk() && hold(sx, sy, true)) {
        hold(sx, sy, false);
        return;
      }
      step();
    });
    btn.addEventListener('keydown', () => { pressed = false; });
    // A long press on a phone would otherwise open the browser's menu.
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  window.addEventListener('blur', stopHold);
}

// What a press on the look stick means (light battery plan step D), apart
// from the page, so it can be tested with a hand-run clock: `timers`
// { set(fn, ms), clear(id) } and `now()`. A press held `holdMs` calls
// `onWait()` (`onHold(true)` as the press starts, so the stick can show its
// ring, and `onHold(false)` when the hold ends either way). A tap calls
// `onTurn()` when `wantsTurn()` and no taps are counting; otherwise taps
// count, each within `tapMs` of the last: the LOOK_STICK_LIGHT_TAPS-th
// calls `onLight()`, and the ones before it `onCount(n)`. A drag cancels
// the hold and the count.
export function stickGestures({ onWait, onLight, onTurn, onCount, onHold, wantsTurn,
  holdMs = LOOK_STICK_HOLD_MS, tapMs = LOOK_STICK_TAP_MS,
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  now = () => performance.now() }) {
  let holdTimer = null;
  let held = false;      // this press already waited
  let taps = 0;
  let lastTapAt = -Infinity;
  const endHold = () => {
    if (holdTimer === null) return;
    timers.clear(holdTimer);
    holdTimer = null;
    onHold(false);
  };
  const resetTaps = () => {
    taps = 0;
    lastTapAt = -Infinity;
  };
  const tap = () => {
    const at = now();
    if (at - lastTapAt > tapMs) taps = 0;
    if (taps === 0 && wantsTurn()) { resetTaps(); onTurn(); return; }
    taps++;
    lastTapAt = at;
    if (taps < LOOK_STICK_LIGHT_TAPS) { onCount(taps); return; }
    resetTaps();
    onLight();
  };
  return {
    press() {
      endHold();
      held = false;
      onHold(true);
      holdTimer = timers.set(() => {
        holdTimer = null;
        held = true;
        resetTaps();
        onHold(false);
        onWait();
      }, holdMs);
    },
    drag() {
      endHold();
      resetTaps();
    },
    // The press ended: a tap, unless it already waited or `tapped` is
    // false (a drag, a cancelled press).
    release(tapped = true) {
      endHold();
      if (held) { held = false; return; }
      if (tapped) tap();
    },
    // A tap with no press behind it (Enter on the focused stick).
    tap,
  };
}

// Wires the look stick, the d-pad's centre `button` (with a `.look-knob`
// inside). A drag past LOOK_STICK_DRAG_PX calls `aim(dx, dy)` with the push
// on screen, and the knob follows up to LOOK_STICK_KNOB_PX, springing back
// on release; pointer capture keeps the drag when the finger leaves the
// button. Taps and holds go through stickGestures: hold to `wait()`, a tap
// to `turn()` when `wantsTurn()`, 3 taps to `light()`, and `count(n)` for
// the taps before the third, so a stray tap never spends a turn. While a
// press could still become a hold, the button has the class `holding` (its
// filling ring, index.html). `done()` is called when a drag ends (the
// shoulder view's sweep stops then).
export function initLookStick({ button, aim, wait, light, count, turn, wantsTurn, done = () => {} }) {
  const knob = button.querySelector('.look-knob');
  let press = null;      // { x, y, id, dragged } while held
  let pressed = false;   // a pointer press already counted; skip the click that follows it
  const gestures = stickGestures({
    onWait: wait, onLight: light, onTurn: turn, onCount: count,
    onHold: on => button.classList.toggle('holding', on),
    wantsTurn,
  });
  const moveKnob = (dx, dy) => {
    const length = Math.hypot(dx, dy);
    const scale = length > LOOK_STICK_KNOB_PX ? LOOK_STICK_KNOB_PX / length : 1;
    // With 8 ways off the d-pad is turned 45° (index.html .dpad.four-ways),
    // so the screen's push is turned back into the button's own directions.
    const turned = !!button.closest('.four-ways');
    const x = turned ? (dx + dy) * Math.SQRT1_2 * scale : dx * scale;
    const y = turned ? (dy - dx) * Math.SQRT1_2 * scale : dy * scale;
    knob.style.transform = length ? 'translate(' + x + 'px, ' + y + 'px)' : '';
  };
  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || button.disabled) return;
    e.preventDefault();
    pressed = true;
    press = { x: e.clientX, y: e.clientY, id: e.pointerId, dragged: false };
    button.setPointerCapture(e.pointerId);
    gestures.press();
  });
  button.addEventListener('pointermove', (e) => {
    if (!press || press.id !== e.pointerId) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.dragged && Math.hypot(dx, dy) <= LOOK_STICK_DRAG_PX) return;
    if (!press.dragged) gestures.drag();
    press.dragged = true;
    moveKnob(dx, dy);
    aim(dx, dy);
  });
  const release = (e, cancelled) => {
    if (!press || press.id !== e.pointerId) return;
    const dragged = press.dragged;
    press = null;
    moveKnob(0, 0);
    if (dragged) done();
    gestures.release(!dragged && !cancelled && !button.disabled);
  };
  button.addEventListener('pointerup', (e) => release(e, false));
  button.addEventListener('pointercancel', (e) => release(e, true));
  button.addEventListener('click', () => {
    if (pressed) { pressed = false; return; }
    if (!button.disabled) gestures.tap();
  });
  button.addEventListener('keydown', () => { pressed = false; });
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Ends a held walk.
function stopHold() {
  clearTimeout(holdTimer);
  holdTimer = null;
}
