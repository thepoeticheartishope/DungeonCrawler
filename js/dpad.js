// On-screen d-pad: hold an arrow to keep walking, the way a held arrow key
// does, so a touch player doesn't have to tap once per tile. The centre is
// the look stick (free look plan step C): drag it to aim the light, tap it
// to turn or (twice) to wait. main.js passes in the buttons and the
// actions; this file only handles input.
import { DPAD_HOLD_DELAY_MS, DPAD_HOLD_REPEAT_MS, LOOK_STICK_DRAG_PX, LOOK_STICK_KNOB_PX, LOOK_STICK_WAIT_MS } from './config.js';

const STEPS = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };

let holdTimer = null;

// Wires the d-pad's arrows: they step on press and repeat while held. The
// centre is wired by initLookStick. `canWalk()` says whether the room screen is
// taking moves right now; the repeat stops as soon as it isn't (a fight opened,
// the floor changed, the run ended).
export function initDpad({ buttons, movePlayer, canWalk }) {
  for (const [dir, [dRow, dCol]] of Object.entries(STEPS)) {
    const btn = buttons[dir];
    let pressed = false; // a pointer press already stepped; skip the click that follows it
    const step = () => {
      if (btn.disabled || !canWalk()) { stopHold(); return; }
      movePlayer(dRow, dCol);
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
    // The d-pad is turned 45° (index.html .dpad), so the screen's push is
    // turned back into the button's own directions.
    const x = (dx + dy) * Math.SQRT1_2 * scale;
    const y = (dy - dx) * Math.SQRT1_2 * scale;
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
