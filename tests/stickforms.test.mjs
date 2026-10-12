// Unit tests for the STICK_POSES table in stickforms.js: every pose must
// hold the same joints at rest and in its tell, join only joints it has,
// and have two limbs made of its own bones, so a typo in a new pose fails
// here instead of drawing a broken stick man.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STICK_POSES } from '../js/stickforms.js';

const poses = Object.entries(STICK_POSES);

test('there are seven poses, a plain standing one among them', () => {
  assert.equal(poses.length, 7);
  assert.ok(STICK_POSES.standing);
});

test('every pose has the same joints at rest and in its tell', () => {
  poses.forEach(([id, pose]) => {
    assert.deepEqual(Object.keys(pose.tell).sort(), Object.keys(pose.rest).sort(), `${id}: rest and tell joints differ`);
    Object.entries({ ...pose.rest, ...pose.tell }).forEach(([joint, at]) => {
      assert.ok(Array.isArray(at) && at.length === 2 && at.every(Number.isFinite), `${id}: joint ${joint} is not [x, y]`);
    });
  });
});

test('every bone, head, core and idle movement names joints the pose has', () => {
  poses.forEach(([id, pose]) => {
    const has = joint => joint in pose.rest;
    pose.bones.forEach(([a, b], i) => assert.ok(has(a) && has(b), `${id}: bone ${i} joins ${a} and ${b}`));
    pose.heads.forEach(([joint, r]) => assert.ok(has(joint) && r > 0, `${id}: head on ${joint}`));
    assert.ok(pose.core.length === 2 && pose.core.every(has), `${id}: core`);
    pose.idle.forEach(([joints]) => joints.forEach(j => assert.ok(has(j), `${id}: idle moves ${j}`)));
    assert.ok(pose.shadow > 0, `${id}: shadow`);
  });
});

test('every pose has two limbs of its own bones, none shared, rooted on a joint', () => {
  poses.forEach(([id, pose]) => {
    assert.equal(pose.limbs.length, 2, `${id}: limbs`);
    const used = pose.limbs.flatMap(l => l.bones);
    assert.equal(new Set(used).size, used.length, `${id}: a bone is in both limbs`);
    pose.limbs.forEach((limb, i) => {
      assert.ok(limb.bones.length > 0, `${id}: limb ${i} has no bones`);
      limb.bones.forEach(b => assert.ok(b >= 0 && b < pose.bones.length, `${id}: limb ${i} bone ${b}`));
      assert.ok(limb.root in pose.rest, `${id}: limb ${i} root ${limb.root}`);
      assert.ok(Number.isFinite(limb.angle), `${id}: limb ${i} angle`);
    });
    assert.ok(used.length < pose.bones.length, `${id}: no body left once both limbs are gone`);
  });
});
