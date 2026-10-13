// On-screen d-pad: hold an arrow to keep walking, the way a held arrow key
// does, so a touch player doesn't have to tap once per tile. Since the
// eight ways plan it is a square pad of 8 arrows, each walking that way on
// screen (screenStep); with DEV -> 8 ways off it is turned 45° with only its
// 4 edge arrows, as before. Also the arrow keys' chord (arrowChord): two
// arrows together walk a diagonal. The centre is
// the look stick (free look plan step C): drag it to aim the light, tap it
// to turn or (twice) to wait. main.js passes in the buttons and the
// actions; this file only handles input.
import { DPAD_HOLD_DELAY_MS, DPAD_HOLD_REPEAT_MS, LOOK_STICK_DRAG_PX, LOOK_STICK_KNOB_PX, LOOK_STICK_WAIT_MS, KEY_CHORD_MS } from './config.js';

// The pad's arrows by where they point on screen, as [x, y] (y down). The
// d-pad's buttons and the arrow keys are named by these.
export const SCREEN_WAYS = {
  U: [0, -1], UR: [1, -1], R: [1, 0], DR: [1, 1],
  D: [0, 1], DL: [-1, 1], L: [-1, 0], UL: [-1, -1],
};

// The grid step [dRow, dCol] for a push (sx, sy) on screen, or null. With
// 8 ways it walks that way on screen: grid north is up and to the right, so
// screen up is grid NW and up-right is grid N. With 8 ways off the pad is
// turned 45° and the keys walk as they did: up is grid north, and a
// diagonal does nothing.
export function screenStep(sx, sy, eightWays) {
  if (!sx && !sy) return null;
  if (!eightWays) return sx && sy ? null : [sy, sx];
  return [Math.sign(sy - sx), Math.sign(sy + sx)];
}

// The arrow keys' chord (eight ways plan, call 5): two arrows pressed
// together walk a diagonal. After a first arrow it waits `waitMs` for a
// second; a second arrow inside that wait steps at once, and an arrow
// released inside it still counts. A key's own repeat (held down) steps
// whatever arrows are held. Up with down, or left with right, cancel out.
// `step(sx, sy)` walks; `timers` stands in for setTimeout / clearTimeout
// in tests. Returns { down(way, repeat), up(way), reset() }, ways being
// 'U', 'D', 'L' or 'R'.
export function arrowChord(step, waitMs = KEY_CHORD_MS, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) }) {
  const held = new Set();
  let pending = null; // arrows pressed inside the wait
  let timer = null;
  const walk = (ways) => {
    const sx = (ways.has('R') ? 1 : 0) - (ways.has('L') ? 1 : 0);
    const sy = (ways.has('D') ? 1 : 0) - (ways.has('U') ? 1 : 0);
    if (sx || sy) step(sx, sy);
  };
  const fire = () => {
    const ways = new Set([...pending, ...held]);
    timer = null;
    pending = null;
    walk(ways);
  };
  return {
    down(way, repeat) {
      held.add(way);
      if (repeat) {
        if (!timer) walk(held);
        return;
      }
      if (timer) {
        pending.add(way);
        timers.clear(timer);
        fire();
        return;
      }
      pending = new Set([way]);
      timer = timers.set(fire, waitMs);
    },
    up(way) {
      held.delete(way);
    },
    reset() {
      held.clear();
      if (timer) timers.clear(timer);
      timer = null;
      pending = null;
    },
  };
}

let holdTimer = null;

// Wires the d-pad's arrows (`buttons`, by SCREEN_WAYS name): they step on
// press and repeat while held, each the way screenStep gives for 8 ways or
// 4 (`eightWays()`). The centre is wired by initLookStick. `canWalk()` says
// whether the room screen is taking moves right now; the repeat stops as soon
// as it isn't (a fight opened, the floor changed, the run ended).
export function initDpad({ buttons, movePlayer, canWalk, eightWays }) {
  for (const [dir, [sx, sy]] of Object.entries(SCREEN_WAYS)) {
    const btn = buttons[dir];
    let pressed = false; // a pointer press already stepped; skip the click that follows it
    const step = () => {
      const grid = screenStep(sx, sy, eightWays());
      if (btn.disabled || !grid || !canWalk()) { stopHold(); return; }
      movePlayer(grid[0], grid[1]);
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); // no text selection or focus ring from a held finger
      pressed = true;
      stopHold();
      step();
      holdTimer = setTimeout(function repeat() {
        step();
        if (holdTimer !== null) holdTimer = setTimeout(repeat, DPAD_HOLD_REPEAT_MS);
      }, DPAD_HOLD_DELAY_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => btn.addEventListener(type, stopHold));
    // A click with no pointer behind it (Enter or Space on a focused button)
    // still takes one step. The click a mouse or touch press ends with is
    // skipped, since that press already stepped on pointerdown.
    btn.addEventListener('click', () => {
      if (pressed) { pressed = false; return; }
      step();
    });
    btn.addEventListener('keydown', () => { pressed = false; });
    // A long press on a phone would otherwise open the browser's menu.
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  window.addEventListener('blur', stopHold);
}

// Wires the look stick, the d-pad's centre `button` (with a `.look-knob`
// inside). A drag past LOOK_STICK_DRAG_PX calls `aim(dx, dy)` with the push
// on screen, and the knob follows up to LOOK_STICK_KNOB_PX, springing back
// on release; pointer capture keeps the drag when the finger leaves the
// button. A tap (or Enter on the focused stick) calls `turn()` when
// `wantsTurn()`; otherwise the first tap calls `waitAgain()` (the room note
// asks for a second) and a second within LOOK_STICK_WAIT_MS calls `wait()`,
// so a stray tap never spends a turn.
export function initLookStick({ button, aim, wait, waitAgain, turn, wantsTurn }) {
  const knob = button.querySelector('.look-knob');
  let press = null;      // { x, y, id, dragged } while held
  let firstTapAt = -Infinity;
  let pressed = false;   // a pointer press already counted; skip the click that follows it
  const tap = () => {
    if (button.disabled) return;
    if (wantsTurn()) { firstTapAt = -Infinity; turn(); return; }
    const now = performance.now();
    if (now - firstTapAt <= LOOK_STICK_WAIT_MS) { firstTapAt = -Infinity; wait(); return; }
    firstTapAt = now;
    waitAgain();
  };
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
  });
  button.addEventListener('pointermove', (e) => {
    if (!press || press.id !== e.pointerId) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.dragged && Math.hypot(dx, dy) <= LOOK_STICK_DRAG_PX) return;
    press.dragged = true;
    moveKnob(dx, dy);
    aim(dx, dy);
  });
  const release = (e, cancelled) => {
    if (!press || press.id !== e.pointerId) return;
    const dragged = press.dragged;
    press = null;
    moveKnob(0, 0);
    if (!dragged && !cancelled) tap();
  };
  button.addEventListener('pointerup', (e) => release(e, false));
  button.addEventListener('pointercancel', (e) => release(e, true));
  button.addEventListener('click', () => {
    if (pressed) { pressed = false; return; }
    tap();
  });
  button.addEventListener('keydown', () => { pressed = false; });
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Ends a held walk.
function stopHold() {
  clearTimeout(holdTimer);
  holdTimer = null;
}
