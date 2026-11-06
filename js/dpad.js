// The walk stick (one stick plan step B): drag from its middle to walk the
// way it points, hold it still to look up, tap it for a hint. The square
// d-pad and the look stick went with the turn-based game (dungeon removal
// step E1). controls.js passes in the actions; this file only handles input.
import { LOOK_STICK_DRAG_PX, ONE_STICK } from './config.js';

// The screen ways, as [x, y] (y down). The arrow keys and the number pad
// are named by these.
export const SCREEN_WAYS = {
  U: [0, -1], UR: [1, -1], R: [1, 0], DR: [1, 1],
  D: [0, 1], DL: [-1, 1], L: [-1, 0], UL: [-1, -1],
};

// What a press on the walk stick means, apart from the page, so it can be
// tested with a hand-run clock: `timers` { set(fn, ms), clear(id) }. A
// press held `holdMs` calls `onWait()` (`onHold(true)` as the press starts,
// so the stick can show its ring, and `onHold(false)` when the hold ends
// either way). A tap calls `onTap()` (a hint). A drag cancels the hold.
export function stickGestures({ onWait, onTap, onHold, holdMs,
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) } }) {
  let holdTimer = null;
  let held = false;      // this press already waited
  const endHold = () => {
    if (holdTimer === null) return;
    timers.clear(holdTimer);
    holdTimer = null;
    onHold(false);
  };
  const tap = () => onTap();
  return {
    press() {
      endHold();
      held = false;
      onHold(true);
      holdTimer = timers.set(() => {
        holdTimer = null;
        held = true;
        onHold(false);
        onWait();
      }, holdMs);
    },
    drag() {
      endHold();
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

// The round walk stick (one stick plan step B): drag from its middle to walk the way it points;
// how far it is pushed sets the pace (walk.js: a push in the dead zone only
// turns, a small one creeps). `push(x, y)` gets the push on screen, each
// of x and y from -1 to 1 (its length at most 1), on every move;
// `release()` when the finger lifts. Until the finger moves
// LOOK_STICK_DRAG_PX or leaves the dead zone, the press is still: it
// pushes nothing, so a tap never turns the light by chance. A still press
// held ONE_STICK.lookUpMs calls `lookUp(true)` (and `lookUp(false)` as it
// ends): looking up at the sky; a tap calls `tap()` (a hint).
export function initWalkStick({ el, push, release, lookUp, tap }) {
  const knob = el.querySelector('.walk-knob');
  el.style.setProperty('--creep', ONE_STICK.creep); // the dashed ring
  let press = null; // { id, x, y, moved } while held
  const gestures = stickGestures({
    onWait: () => lookUp(true), onTap: tap,
    onHold: on => el.classList.toggle('holding', on),
    holdMs: ONE_STICK.lookUpMs,
  });
  // The push under the pointer, from the stick's middle, as a share of
  // its reach (its radius less half the knob).
  const pushAt = (e) => {
    const r = el.getBoundingClientRect();
    const reach = r.width / 2 - knob.offsetWidth / 2;
    let x = (e.clientX - r.left - r.width / 2) / reach;
    let y = (e.clientY - r.top - r.height / 2) / reach;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    return { x, y, reach };
  };
  const follow = (e) => {
    const { x, y, reach } = pushAt(e);
    const travel = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (!press.moved && travel <= LOOK_STICK_DRAG_PX && Math.hypot(x, y) < ONE_STICK.deadZone) return;
    if (!press.moved) gestures.drag();
    press.moved = true;
    knob.style.transform = 'translate(' + x * reach + 'px, ' + y * reach + 'px)';
    push(x, y);
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    gestures.press();
    follow(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (press && press.id === e.pointerId) follow(e);
  });
  const end = (e, cancelled) => {
    if (!press || press.id !== e.pointerId) return;
    const moved = press.moved;
    press = null;
    knob.style.transform = '';
    release();
    lookUp(false);
    gestures.release(!moved && !cancelled);
  };
  el.addEventListener('pointerup', (e) => end(e, false));
  el.addEventListener('pointercancel', (e) => end(e, true));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
