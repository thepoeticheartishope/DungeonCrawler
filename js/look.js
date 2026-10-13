// Free look (free look plan): the body faces one of 4 ways on the grid
// (state.floor.facing), and the light points wherever the player aims, up
// to LOOK_FREE_ARC either side of the body. Aiming costs no turn; turning
// the body to look further round costs one. Angles are on the grid: 0 =
// north (row -1), +90° = east (col +1). Rules only; no DOM access here.

import { state } from './state.js';
import { LOOK_FREE_ARC } from './config.js';
import { computeVisibility } from './sight.js';
import { refreshGunTarget } from './gun.js';

export const BODY_ANGLES = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };

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
// or free look off: 0.
function aimOffset() {
  if (!state.settings.freeLook || typeof state.floor.look !== 'number') return 0;
  return wrapAngle(state.floor.look - bodyAngle());
}

// Where the light points: the aim, held inside the free arc.
export function lookAngle() {
  return bodyAngle() + Math.max(-LOOK_FREE_ARC, Math.min(LOOK_FREE_ARC, aimOffset()));
}

// True when the aim is past the free arc, so seeing it needs a turn.
export function wantsTurn() {
  return Math.abs(aimOffset()) > LOOK_FREE_ARC + 1e-6;
}

// Aims at `angle`. The light follows as far as the arc allows, and the
// gun's target follows the light. Costs no turn. Events: the gun's
// targetPicked, when the target changed.
export function aimLook(angle) {
  state.floor.look = wrapAngle(angle);
  computeVisibility();
  return state.settings.gunCombat ? refreshGunTarget() : [];
}

// Turns the body to whichever of the 4 ways is closest to the aim, so the
// light can reach it. The caller spends the turn (minions move), as for
// waiting. Events: bodyTurned { facing }, or none when no turn is wanted.
export function turnBody() {
  if (!wantsTurn()) return [];
  const aim = state.floor.look;
  const ways = Object.keys(BODY_ANGLES);
  const facing = ways.reduce((best, way) =>
    Math.abs(wrapAngle(aim - BODY_ANGLES[way])) < Math.abs(wrapAngle(aim - BODY_ANGLES[best])) ? way : best);
  state.floor.facing = facing;
  computeVisibility();
  return [{ type: 'bodyTurned', facing }];
}

// The player stepped or turned by walking: the aim goes back to straight
// ahead, so the light points the way they walk. Timothy: a look kept at the
// arc's edge while walking was jarring; looking round is for standing still.
export function followBody() {
  state.floor.look = bodyAngle();
}
