// Unit tests for the shoulder view's camera maths (js/shoulderview.js,
// shoulder view plan step A): a point straight ahead lands mid-screen, a
// point behind the camera is cut off, and the camera pulls in from a wall
// (side first, then back) so it never stands in one; a tap's ray finds the
// floor point under it (step B).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOULDER_CAMERA } from '../js/config.js';
import { shoulderCamera, pulledIn, toCamera, projectPoint, floorAt } from '../js/shoulderview.js';

const W = 400;
const H = 600;
const open = () => false;
const middle = { x: 10.5, y: 10.5 };

test('a point straight ahead of the camera lands mid-screen', () => {
  const cam = shoulderCamera(middle, 0, W, H, open);
  const ahead = [cam.x + cam.F[0] * 5, cam.y + cam.F[1] * 5, cam.z + cam.F[2] * 5];
  const [sx, sy] = projectPoint(cam, ahead);
  assert.ok(Math.abs(sx - W / 2) < 1e-6);
  assert.ok(Math.abs(sy - H / 2) < 1e-6);
});

test('the camera stands behind and to the right of the player, below the walls', () => {
  const cam = shoulderCamera(middle, 0, W, H, open); // looking north (row -1)
  assert.ok(Math.abs(cam.y - (middle.y + SHOULDER_CAMERA.back)) < 1e-9, 'behind is south');
  assert.ok(Math.abs(cam.x - (middle.x + SHOULDER_CAMERA.side)) < 1e-9, 'right is east');
  assert.ok(cam.z < SHOULDER_CAMERA.wallHeight);
  const east = shoulderCamera(middle, Math.PI / 2, W, H, open);
  assert.ok(east.x < middle.x && east.y > middle.y, 'looking east: behind is west, right is south');
});

test('the player stands left of the middle, in front of the camera', () => {
  const cam = shoulderCamera(middle, 0, W, H, open);
  const [, , ahead] = toCamera(cam, [middle.x, middle.y, 0]);
  assert.ok(ahead > 0);
  const [sx] = projectPoint(cam, [middle.x, middle.y, 0.4]);
  assert.ok(sx < W / 2);
});

test('a point behind the camera is cut off', () => {
  const cam = shoulderCamera(middle, 0, W, H, open);
  assert.equal(projectPoint(cam, [cam.x, cam.y + 2, 0]), null);
});

test('a wall on the right pulls the camera in, side first', () => {
  const eastWall = (row, col) => col >= 11; // the wall starts right beside the player's tile
  const { side, back } = pulledIn(middle, 0, eastWall);
  assert.ok(side < SHOULDER_CAMERA.side);
  assert.equal(back, SHOULDER_CAMERA.back);
});

test('a wall behind pulls the camera in close', () => {
  const southWall = (row, col) => row >= 11;
  const { side, back } = pulledIn(middle, 0, southWall);
  assert.equal(side, 0);
  assert.ok(back < SHOULDER_CAMERA.back);
});

test('in the open the camera keeps its full place', () => {
  assert.deepEqual(pulledIn(middle, 1.2, open), { side: SHOULDER_CAMERA.side, back: SHOULDER_CAMERA.back });
});

test('a tap finds the floor point it shows', () => {
  const cam = shoulderCamera(middle, 0.7, W, H, open);
  for (const point of [[10.5, 8.5], [12.2, 7.9], [9.1, 9.6]]) {
    const [sx, sy] = projectPoint(cam, [...point, 0]);
    const [x, y] = floorAt(cam, sx, sy);
    assert.ok(Math.abs(x - point[0]) < 1e-6 && Math.abs(y - point[1]) < 1e-6, `${point} came back as ${x},${y}`);
  }
});

test('a tap above the horizon finds no floor', () => {
  const cam = shoulderCamera(middle, 0, W, H, open);
  assert.equal(floorAt(cam, W / 2, 0), null);
});
