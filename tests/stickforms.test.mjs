// Unit tests for stickforms.js. The STICK_POSES table: every pose must
// hold the same joints at rest and in its tell, join only joints it has,
// and have two limbs made of its own bones, so a typo in a new pose fails
// here instead of drawing a broken stick man. Tendril letters: each word
// has exactly one letter wrong.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STICK_POSES, almostWord, tendrilLetters, stickBox, crawlHands, DOWNED_POSE } from '../js/stickforms.js';
import { TENDRIL_LOOKALIKES, MINION_KINDS } from '../js/config.js';

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

// ---- Tendril letters (step C) ----

// How many places in `word` came out changed: another letter, or drawn backwards.
const changes = (word, out) => out.filter((L, i) => L.ch !== [...word][i] || L.mirror).length;

test('every word changes exactly one letter, and spaces and digits are left alone', () => {
  const words = ['NOAH', 'MOSES', 'GEN', '6:14', 'EX', '12:31', '1', 'KGS', 'BETHLEHEM', 'A', 'PORT 443', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  for (let seed = 1; seed < 400; seed++) {
    words.forEach(word => {
      const out = almostWord(word, seed);
      assert.equal(out.length, [...word].length, `${word}: length changed`);
      const letters = [...word].filter(c => /[A-Z]/.test(c)).length;
      assert.equal(changes(word, out), letters ? 1 : 0, `${word} (seed ${seed}): ${JSON.stringify(out)}`);
      [...word].forEach((c, i) => {
        if (!/[A-Z]/.test(c)) assert.deepEqual(out[i], { ch: c }, `${word}: '${c}' was changed`);
      });
    });
  }
});

test('every letter A-Z has a lookalike that is another character', () => {
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    assert.ok(TENDRIL_LOOKALIKES[c] && TENDRIL_LOOKALIKES[c] !== c, `no lookalike for ${c}`);
  }
});

test('tendril letters are the same for the same seed, and as many as asked for', () => {
  const a = tendrilLetters(42, 17);
  assert.equal(a.length, 17);
  assert.deepEqual(tendrilLetters(42, 17), a);
  assert.ok(a.some(L => L.ch === ' '), 'no gap between words');
});

// Downed stick men (downed plan step B). A tile 100 px wide; the stick
// man's height is the old isometric map's STICK_HEIGHT (0.62) of it.
const TILE = 100;
const HEIGHT = 0.62 * TILE;

test('a downed one\'s box stays within a tile either side, and lower than it stood', () => {
  Object.keys(MINION_KINDS).forEach(minionKind => {
    const [left, top, right, bottom] = stickBox({ minionKind, downed: true }, 0, 0, HEIGHT);
    assert.ok(-left <= TILE && right <= TILE, `${minionKind}: ${left}..${right}`);
    assert.equal(bottom, 0, 'it lies on its tile');
    const standing = stickBox({ minionKind, downed: false }, 0, 0, HEIGHT);
    assert.ok(top > standing[1], `${minionKind}: lower than it stood`);
  });
});

test('the downed pose holds the joints it is drawn from', () => {
  ['hip', 'sh', 'neck', 'head', 'handF', 'handB'].forEach(joint => {
    assert.ok(DOWNED_POSE[joint].every(Number.isFinite), joint);
  });
});

test('through a crawl, each hand stays within half a tile of the body and ends a tile on', () => {
  // A step half a tile across and a quarter down: one tile along a floor diagonal.
  const a = [0, 0];
  const b = [TILE / 2, TILE / 4];
  const lead = [-0.62 * HEIGHT, 0.08 * HEIGHT];
  const trail = [-0.52 * HEIGHT, -0.08 * HEIGHT];
  const step = Math.hypot(b[0], b[1]);
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const hands = crawlHands(p, a, b, lead, trail);
    // The body is somewhere between its two tiles; each hand stays within
    // half a step of where it would rest on one of them.
    const near = (hand, rest) => Math.min(
      Math.hypot(hand[0] - a[0] - rest[0], hand[1] - a[1] - rest[1]),
      Math.hypot(hand[0] - b[0] - rest[0], hand[1] - b[1] - rest[1]),
    );
    assert.ok(near(hands.lead, lead) <= step / 2 + 1e-9, `lead at ${p.toFixed(2)}`);
    assert.ok(near(hands.trail, trail) <= step / 2 + 1e-9, `trail at ${p.toFixed(2)}`);
    assert.ok(hands.leadLift >= 0 && hands.trailLift >= 0);
  }
  const end = crawlHands(1, a, b, lead, trail);
  assert.ok(Math.hypot(end.lead[0] - b[0] - lead[0], end.lead[1] - b[1] - lead[1]) < 1e-9, 'lead ends on the new tile');
  assert.ok(Math.hypot(end.trail[0] - b[0] - trail[0], end.trail[1] - b[1] - trail[1]) < 1e-9, 'trail ends on the new tile');
});
