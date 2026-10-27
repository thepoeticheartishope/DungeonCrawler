// Unit tests for the 3D moves (figure3d.js, moves3d.js; one stick plan
// step F): every move has whole frames of every joint; a walk's frame
// follows the ground covered, not the clock; a new move blends in over
// FIGURE3D.blendMs; a move played once comes first; the projection puts
// the head over the feet and a figure facing east reaches right; reduced
// motion shows the first frame.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MOVES3D, MOVE_JOINTS } from '../js/moves3d.js';
import { FIGURE3D } from '../js/config.js';
import { figurePose, projectFigure, phiOfAngle, playOnce, sampleMove, moveFrames } from '../js/figure3d.js';

const METRES = 1.4; // metres a tile
const joint = (joints, name) => joints.slice(MOVE_JOINTS.indexOf(name) * 3, MOVE_JOINTS.indexOf(name) * 3 + 3);

test('every move has frames of every joint, standing on the floor', () => {
  Object.entries(MOVES3D).forEach(([name, move]) => {
    assert.ok(move.frames.length > 0 && move.ms > 0, name);
    move.frames.forEach(f => assert.ok(f.length === MOVE_JOINTS.length * 3 && f.every(Number.isFinite), name));
  });
  const stand = sampleMove('Idle_Loop', 0, true);
  assert.ok(Math.abs(joint(stand, 'ftL')[1]) < 0.15 && joint(stand, 'head')[1] > 1.4);
});

test("a walk's frame follows the ground covered, not the clock", () => {
  const fast = {}, slow = {};
  // Both well past the blend into the walk, the same ground covered.
  for (let i = 0; i <= 20; i++) {
    figurePose(fast, { at: [i * 0.05, 0], metres: METRES }, i * 16);
    figurePose(slow, { at: [i * 0.05, 0], metres: METRES }, i * 40);
  }
  const a = figurePose(fast, { at: [1.05, 0], metres: METRES }, 21 * 16);
  const b = figurePose(slow, { at: [1.05, 0], metres: METRES }, 21 * 40);
  assert.deepEqual(a.map(v => v.toFixed(3)), b.map(v => v.toFixed(3)));
});

test('a new move blends in over blendMs', () => {
  const fig = {};
  figurePose(fig, { at: [0, 0], metres: METRES }, 0);
  const stand = figurePose(fig, { at: [0, 0], metres: METRES }, 500);
  const punch = { move: 'Punch_Cross', frame: FIGURE3D.punchPeak };
  assert.deepEqual(figurePose(fig, { at: [0, 0], metres: METRES, pick: punch }, 500), stand, 'the blend starts where it stood');
  const mid = figurePose(fig, { at: [0, 0], metres: METRES, pick: punch }, 500 + FIGURE3D.blendMs / 2);
  const end = figurePose(fig, { at: [0, 0], metres: METRES, pick: punch }, 500 + FIGURE3D.blendMs);
  const hand = j => joint(j, 'haR')[2];
  assert.ok(hand(stand) < hand(mid) && hand(mid) < hand(end), 'the fist goes out over the blend');
  assert.deepEqual(end, sampleMove('Punch_Cross', FIGURE3D.punchPeak, false));
});

test('a move played once comes first, then the figure goes back to standing', () => {
  const fig = {};
  figurePose(fig, { at: [0, 0], metres: METRES }, 0);
  playOnce(fig, 'Hit_Head', 1000);
  figurePose(fig, { at: [0, 0], metres: METRES }, 1000);
  const hit = figurePose(fig, { at: [0, 0], metres: METRES }, 1000 + FIGURE3D.blendMs);
  assert.notDeepEqual(hit, figurePose({}, { at: [0, 0], metres: METRES }, 0));
  const after = figurePose(fig, { at: [0, 0], metres: METRES }, 1000 + MOVES3D.Hit_Head.ms + FIGURE3D.blendMs * 2);
  const stand = sampleMove('Idle_Loop', 0, true);
  assert.ok(Math.abs(joint(after, 'head')[1] - joint(stand, 'head')[1]) < 0.1, 'standing again');
});

test('the projection puts the head over the feet, and one facing east punches right', () => {
  const punch = sampleMove('Punch_Cross', FIGURE3D.punchPeak, false);
  const P = projectFigure(punch, phiOfAngle(Math.PI / 2), 100, 100, 10);
  assert.ok(P.headMid[1] < P.pelvis[1] && P.pelvis[1] < P.ftL[1]);
  assert.ok(P.haR[0] > P.pelvis[0] + 3, 'the fist is out to the right');
  const W = projectFigure(punch, phiOfAngle(-Math.PI / 2), 100, 100, 10);
  assert.ok(W.haR[0] < W.pelvis[0] - 3, 'and to the left facing west');
});

test('reduced motion shows the first frame, with no blending', () => {
  const fig = {};
  const still = figurePose(fig, { at: [0, 0], metres: METRES, pick: { move: 'Death01', frame: moveFrames('Death01') - 1 } }, 0, true);
  assert.deepEqual(still, sampleMove('Death01', moveFrames('Death01') - 1, false));
  assert.deepEqual(figurePose(fig, { at: [1, 0], metres: METRES }, 100, true), sampleMove('Idle_Loop', 0, true), 'moving, it stands');
});
