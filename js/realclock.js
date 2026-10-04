// The real-time clock (gun plan step 8). With Real time on (start screen),
// the world takes its turn every REALTIME_STEP_MS instead of after each of
// the player's actions. main.js polls it every REALTIME_POLL_MS and tells
// it whether it may run; time only counts while it may, so a pause (the
// damage bar, the battle screen, a menu) never ends in a tick the moment it
// lifts. No DOM access here, and no timers: main.js owns the poll.

import { REALTIME_STEP_MS, REALTIME_POLL_MS } from './config.js';

// Time counted toward the next tick, and when the last poll came. View-side
// timing, so module vars rather than state (state holds no timers).
let banked = 0;
let lastPoll = null;
// Which way the NEXT meter's edge runs this step: filling, or emptying. It
// turns at each tick, so the meter never jumps back to empty.
let filling = true;

// One poll at time `now` (ms). `running` says whether the clock may run
// right now. Returns true when the world's turn is due; the caller runs it.
// A long gap between polls (a stalled page) counts as one poll at most, so
// ticks never pile up and fire back to back.
export function pollClock(now, running) {
  const gap = lastPoll === null ? 0 : Math.max(0, Math.min(now - lastPoll, REALTIME_POLL_MS * 2));
  lastPoll = now;
  if (!running) return false;
  banked += gap;
  if (banked < REALTIME_STEP_MS) return false;
  banked -= REALTIME_STEP_MS;
  filling = !filling;
  return true;
}

// How far along the next tick is, for the HUD's NEXT meter: `share` 0..1
// and whether this step fills the meter or empties it. Either way the
// meter's edge reaches the far end as the world moves.
export function clockReading() {
  return { share: Math.min(banked / REALTIME_STEP_MS, 1), filling };
}

// Starts the count again from nothing: a new run or a new floor gets the
// full REALTIME_STEP_MS before the world first moves.
export function resetClock() {
  banked = 0;
  lastPoll = null;
  filling = true;
}
