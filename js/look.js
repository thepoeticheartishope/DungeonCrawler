// Free look (free look plan): the body faces one of 8 ways on the grid
// (state.floor.facing), and the light points wherever the player aims, up
// to LOOK_FREE_ARC either side of the body. Aiming costs no turn; turning
// the body to look further round costs one. Angles are on the grid: 0 =
// north (row -1), +90° = east (col +1). Rules only; no DOM access here.

import { state } from './state.js';
import { LOOK_FREE_ARC, ONE_STICK } from './config.js';
import { computeVisibility } from './sight.js';
import { refreshGunTarget } from './gun.js';

export const BODY_ANGLES = {
  N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2,
  NE: Math.PI / 4, SE: 3 * Math.PI / 4, SW: -3 * Math.PI / 4, NW: -Math.PI / 4,
};

// The ways the body can face and walk: all 8 (eight ways plan).
export function waysInUse() {
  return Object.keys(BODY_ANGLES);
}

// The way in use closest to `angle`.
export function nearestWay(angle) {
  return waysInUse().reduce((best, way) =>
    Math.abs(wrapAngle(angle - BODY_ANGLES[way])) < Math.abs(wrapAngle(angle - BODY_ANGLES[best])) ? way : best);
}

// An angle brought into -π..π.
export function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// The grid angle from the player to (row, col).
export function angleTo(row, col) {
  return Math.atan2(col - state.floor.playerCol, -(row - state.floor.playerRow));
}

// The way the body faces, as an angle.
export function bodyAngle() {
  return BODY_ANGLES[state.floor.facing];
}

// How far the aim (state.floor.look) is off the body, -π..π. No aim yet,
// or One stick (the light is the aim itself): 0.
function aimOffset() {
  if (state.settings.oneStick || typeof state.floor.look !== 'number') return 0;
  return wrapAngle(state.floor.look - bodyAngle());
}

// Where the light points: the aim, held inside the free arc. With One
// stick there is no arc: the light points at its own angle, which swings
// round toward where the player goes (swingLook).
export function lookAngle() {
  if (state.settings.oneStick && typeof state.floor.look === 'number') return state.floor.look;
  return bodyAngle() + Math.max(-LOOK_FREE_ARC, Math.min(LOOK_FREE_ARC, aimOffset()));
}

// True when the aim is past the free arc, so seeing it needs a turn.
export function wantsTurn() {
  return Math.abs(aimOffset()) > LOOK_FREE_ARC + 1e-6;
}

// Aims at `angle`. The light follows as far as the arc allows, and the
// gun's target follows the light. Costs no turn. With One stick the
// light swings round to it instead (swingLook), so it never jumps.
// Events: the gun's targetPicked, when the target changed.
export function aimLook(angle) {
  if (state.settings.oneStick) {
    state.floor.lookWant = wrapAngle(angle);
    return [];
  }
  state.floor.look = wrapAngle(angle);
  computeVisibility();
  return refreshGunTarget();
}

// Turns the body to whichever way in use is closest to the aim, so the
// light can reach it. The caller spends the turn (minions move), as for
// waiting. Events: bodyTurned { facing }, or none when no turn is wanted.
export function turnBody() {
  if (!wantsTurn()) return [];
  const facing = nearestWay(state.floor.look);
  state.floor.facing = facing;
  computeVisibility();
  return [{ type: 'bodyTurned', facing }];
}

// Sweeps the light `delta` radians round from where it points now (the
// look stick's sweep, shoulder view plan step B).
// Inside the free arc it costs nothing; once it passes the arc's edge the
// body turns one way in the sweep's direction, and the light sweeps on
// from there without a jump. The caller spends the turn. Events:
// bodyTurned { facing } when the body turned, then the gun's
// targetPicked when the target changed.
export function sweepLook(delta) {
  const events = [];
  state.floor.look = wrapAngle(lookAngle() + delta);
  if (wantsTurn()) {
    const facing = nextWay(Math.sign(delta));
    state.floor.facing = facing;
    events.push({ type: 'bodyTurned', facing });
  }
  computeVisibility();
  events.push(...refreshGunTarget());
  return events;
}

// The next way in use round from the body, clockwise (1) or
// anticlockwise (-1).
function nextWay(dir) {
  const body = bodyAngle();
  return waysInUse()
    .map(way => ({ way, step: wrapAngle(BODY_ANGLES[way] - body) * dir }))
    .filter(w => w.step > 1e-6)
    .sort((a, b) => a.step - b.step)[0].way;
}

// The player stepped or turned by walking: the aim goes back to straight
// ahead, so the light points the way they walk. Timothy: a look kept at the
// arc's edge while walking was jarring; looking round is for standing still.
// With One stick the light keeps its own angle (swingLook).
export function followBody() {
  if (state.settings.oneStick) return;
  state.floor.look = bodyAngle();
}

// One stick (one stick plan step B): swings the light round toward
// state.floor.lookWant at ONE_STICK.turnRate over `dtMs`, with a little
// weight rather than a snap; `still` (reduced motion) turns it at once.
// The body faces the way in use nearest the light (the legs, a bump's
// nudge). Events: the gun's targetPicked, when the target changed.
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
  return refreshGunTarget();
}
