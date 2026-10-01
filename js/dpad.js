// On-screen d-pad: hold an arrow to keep walking, the way a held arrow key
// does, so a touch player doesn't have to tap once per tile. main.js passes
// in the buttons and the move/skip actions; this file only handles input.
import { DPAD_HOLD_DELAY_MS, DPAD_HOLD_REPEAT_MS } from './config.js';

const STEPS = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };

let holdTimer = null;

// Wires the d-pad. Arrows step on press and repeat while held; the centre
// (skip turn) stays one turn per tap, since a held skip would quietly burn
// turns while the light spreads. `canWalk()` says whether the room screen is
// taking moves right now; the repeat stops as soon as it isn't (a fight opened,
// the floor changed, the run ended).
export function initDpad({ buttons, movePlayer, skipTurn, canWalk }) {
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
  buttons.Skip.addEventListener('click', skipTurn);
  window.addEventListener('blur', stopHold);
}

// Ends a held walk.
function stopHold() {
  clearTimeout(holdTimer);
  holdTimer = null;
}
