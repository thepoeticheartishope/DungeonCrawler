// The stick men's 3D moves (one stick plan step F): which move a figure
// shows, blended into the next over FIGURE3D.blendMs, with a walk's legs
// following the ground covered so the feet stay planted, and frames
// smoothed between moves3d.js's samples; then the joints turned to face a
// way and projected for the room view's fixed camera (height up the
// screen, depth squashed by FIGURE3D.depth). roomview.js draws the
// player from it, stickforms.js the stick men. View-only: each figure's
// moment is kept here by its owner (the player's own key object, or a
// minion), never in state. No DOM access here.

import { MOVES3D, MOVES3D_FPS, MOVE_JOINTS } from './moves3d.js';
import { FIGURE3D } from './config.js';

// Each figure's moment, by owner: { move, start, phase, out, from,
// blendAt, at, movedAt, once, phi, turnAt }.
const figures = new WeakMap();

// Where `name`'s joints are at frame `frame` (a fraction blends the two
// samples either side): looping round, or held at its ends.
export function sampleMove(name, frame, loop) {
  const F = MOVES3D[name].frames;
  const n = F.length;
  const f = loop ? ((frame % n) + n) % n : Math.max(0, Math.min(n - 1, frame));
  const i0 = Math.floor(f);
  const i1 = loop ? (i0 + 1) % n : Math.min(n - 1, i0 + 1);
  const u = f - i0;
  return F[i0].map((v, k) => v + (F[i1][k] - v) * u);
}

// How many frames long `name` is.
export function moveFrames(name) {
  return MOVES3D[name].frames.length;
}

// Plays `name` once on `owner`'s figure from `now` (a hit, a death); with
// `hold` it stays on its last frame.
export function playOnce(owner, name, now, hold = false) {
  figureOf(owner, now).once = { move: name, start: now, hold };
}

// Forgets `owner`'s figure (a new floor).
export function resetFigure(owner) {
  figures.delete(owner);
}

// The joints `owner` shows at `now`, in metres (a flat list in
// MOVE_JOINTS' order). `at` is where it stands, in tiles, and `metres` how
// many metres a tile is: moving, it walks (or creeps with `crouch`), the
// walk's frame following the ground covered (FIGURE3D.walkLoopM); still
// for FIGURE3D.stopMs, it stands (or crouches). `pick` is { move, frame }
// to show instead (the reach, a hit, a death), else null; a move played
// once (playOnce) comes first. `offset` starts a standing loop part way
// through, so two figures don't move in step. `still` (reduced motion)
// shows a still pose with no blending: a loop's first frame (standing, even
// while it moves) or the frame asked for. A blend starts on the first frame
// a new move is asked for.
export function figurePose(owner, { at, metres, crouch = false, pick = null, offset = 0 }, now, still = false) {
  const fig = figureOf(owner, now);
  const walked = fig.at ? Math.hypot(at[0] - fig.at[0], at[1] - fig.at[1]) * metres : 0;
  fig.at = at;
  if (walked > 1e-4) fig.movedAt = now;
  const once = fig.once && (fig.once.hold || now - fig.once.start < MOVES3D[fig.once.move].ms) ? fig.once : null;
  if (!once) fig.once = null;
  const walking = now - fig.movedAt < FIGURE3D.stopMs;
  const want = once ? { move: once.move, frame: (now - once.start) / 1000 * MOVES3D_FPS, loop: false }
    : pick ? { ...pick, loop: false }
    : walking ? { move: crouch ? 'Crouch_Fwd_Loop' : 'Walk_Loop', loop: true }
    : { move: crouch ? 'Crouch_Idle_Loop' : 'Idle_Loop', loop: true };
  // Reduced motion: still poses only, so a walker stands.
  if (still) {
    if (FIGURE3D.walkLoopM[want.move]) return sampleMove(crouch ? 'Crouch_Idle_Loop' : 'Idle_Loop', 0, true);
    return sampleMove(want.move, want.loop ? 0 : want.frame, want.loop);
  }
  if (want.move !== fig.move) {
    fig.from = fig.out;
    fig.blendAt = now;
    fig.move = want.move;
    fig.start = now;
    fig.phase = 0;
  }
  let frame = want.frame;
  if (frame === undefined && FIGURE3D.walkLoopM[want.move]) {
    fig.phase += walked / FIGURE3D.walkLoopM[want.move] * moveFrames(want.move);
    frame = fig.phase;
  }
  if (frame === undefined) frame = (now - fig.start) / 1000 * MOVES3D_FPS + offset * moveFrames(want.move);
  const cur = sampleMove(want.move, frame, want.loop);
  const k = fig.from ? (now - fig.blendAt) / FIGURE3D.blendMs : 1;
  fig.out = k >= 1 ? cur : cur.map((v, i) => fig.from[i] + (v - fig.from[i]) * smooth(k));
  if (k >= 1) fig.from = null;
  return fig.out;
}

// Turns `owner`'s figure toward `want` (radians, as projectFigure takes)
// at FIGURE3D.turnRate, so it never snaps; at once under reduced motion
// or the first time. Returns where it faces now.
export function turnFigure(owner, want, now, still = false) {
  const fig = figureOf(owner, now);
  const dt = Math.min(50, now - fig.turnAt) / 1000;
  fig.turnAt = now;
  if (fig.phi === null || still) {
    fig.phi = want;
    return want;
  }
  const gap = Math.atan2(Math.sin(want - fig.phi), Math.cos(want - fig.phi));
  const most = FIGURE3D.turnRate * dt;
  fig.phi += Math.max(-most, Math.min(most, gap));
  return fig.phi;
}

// The way a figure faces, for projectFigure, from a direction on screen
// (dx right, dy down): 0 faces the camera (down the screen).
export function phiToward(dx, dy) {
  return Math.atan2(dx, dy / FIGURE3D.depth);
}

// The way a figure faces from a grid angle (look.js: 0 north = up the
// screen, +π/2 east = right).
export function phiOfAngle(angle) {
  return Math.PI - angle;
}

// `joints` (figurePose) turned to face `phi` and drawn standing on (fx,
// fy) at `pxPerM` pixels a metre: { name: [x, y] } for every MOVE_JOINTS
// joint, plus `headMid`, the head's middle (FIGURE3D.headPast past its
// joint, away from the neck).
export function projectFigure(joints, phi, fx, fy, pxPerM) {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const at = (x, y, z) => [fx + (x * c + z * s) * pxPerM, fy + ((-x * s + z * c) * FIGURE3D.depth - y) * pxPerM];
  const out = {};
  MOVE_JOINTS.forEach((name, i) => { out[name] = at(joints[i * 3], joints[i * 3 + 1], joints[i * 3 + 2]); });
  const h = MOVE_JOINTS.indexOf('head') * 3;
  const n = MOVE_JOINTS.indexOf('neck') * 3;
  const d = [0, 1, 2].map(a => joints[h + a] - joints[n + a]);
  const len = Math.hypot(...d) || 1;
  out.headMid = at(...[0, 1, 2].map(a => joints[h + a] + d[a] / len * FIGURE3D.headPast));
  return out;
}

// `owner`'s moment, made the first time it is asked for.
function figureOf(owner, now) {
  let fig = figures.get(owner);
  if (!fig) {
    fig = { move: null, start: now, phase: 0, out: null, from: null, blendAt: -1e9, at: null, movedAt: -1e9, once: null, phi: null, turnAt: now };
    figures.set(owner, fig);
  }
  return fig;
}

// An ease in and out over 0..1.
function smooth(k) {
  return k * k * (3 - 2 * k);
}
