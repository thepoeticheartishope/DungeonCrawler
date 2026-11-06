// The light's angle (free look, one stick plan): the body faces one of 8
// ways on the grid (state.floor.facing), and the light points at its own
// angle (state.floor.look), which swings round toward where the player
// walks (swingLook). Angles are on the grid: 0 = north (row -1), +90° =
// east (col +1). Rules only; no DOM access here.

import { state } from './state.js';
import { ONE_STICK } from './config.js';
import { computeVisibility } from './sight.js';

export const BODY_ANGLES = {
  N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2,
  NE: Math.PI / 4, SE: 3 * Math.PI / 4, SW: -3 * Math.PI / 4, NW: -Math.PI / 4,
};

// The ways the body can face and walk: all 8 (eight ways plan).
function waysInUse() {
  return Object.keys(BODY_ANGLES);
}

// The way in use closest to `angle`.
function nearestWay(angle) {
  return waysInUse().reduce((best, way) =>
    Math.abs(wrapAngle(angle - BODY_ANGLES[way])) < Math.abs(wrapAngle(angle - BODY_ANGLES[best])) ? way : best);
}

// An angle brought into -π..π.
export function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// The way the body faces, as an angle.
export function bodyAngle() {
  return BODY_ANGLES[state.floor.facing];
}

// Where the light points: its own angle, which swings round toward where
// the player goes (swingLook), or straight ahead before it has one.
export function lookAngle() {
  if (typeof state.floor.look === 'number') return state.floor.look;
  return bodyAngle();
}

// Aims the light at `angle`: it swings round to it (swingLook), so it
// never jumps. Events: none.
export function aimLook(angle) {
  state.floor.lookWant = wrapAngle(angle);
  return [];
}

// One stick (one stick plan step B): swings the light round toward
// state.floor.lookWant at ONE_STICK.turnRate over `dtMs`, with a little
// weight rather than a snap; `still` (reduced motion) turns it at once.
// The body faces the way in use nearest the light (the legs, a bump's
// nudge). Events: none.
export function swingLook(dtMs, still = false) {
  const f = state.floor;
  if (typeof f.lookWant !== 'number') return [];
  const from = lookAngle();
  const gap = wrapAngle(f.lookWant - from);
  if (Math.abs(gap) < 1e-6) return [];
  const most = ONE_STICK.turnRate * dtMs / 1000;
  f.look = still ? f.lookWant : wrapAngle(from + Math.max(-most, Math.min(most, gap)));
  f.facing = nearestWay(f.look);
  computeVisibility();
  return [];
}
