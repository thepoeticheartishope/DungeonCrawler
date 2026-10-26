// Unit tests for the room view (js/roomview.js, room view plan step A):
// which wall tiles show a face, how far the picture is scaled up, where the
// camera frames a room or follows the player, and the d-pad's ways when
// the camera never turns (dpad.js padWay); every kind of thing on the map
// has a drawing (step B, stick men step C).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROOM_VIEW } from '../js/config.js';
import { faceOf, viewScale, cameraGoal } from '../js/roomview.js';
import { padWay } from '../js/dpad.js';

const T = ROOM_VIEW.tilePx;
const EIGHT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// A room of floor at rows 3-6, walls round it, as rows of text.
const plan = [
  '#####',
  '#####',
  '#####',
  '#...#',
  '#...#',
  '#...#',
  '#...#',
  '#####',
];
const wall = (row, col) => row < 0 || row >= plan.length || col < 0 || col >= plan[0].length || plan[row][col] === '#';

test('the back wall shows a face two tiles tall, and side walls none', () => {
  assert.equal(faceOf(2, 2, wall), 'lower', 'just above the floor');
  assert.equal(faceOf(1, 2, wall), 'upper', 'the tile above that');
  assert.equal(faceOf(0, 2, wall), null, 'no taller than faceRows');
  assert.equal(faceOf(4, 0, wall), null, 'a side wall is rim');
  assert.equal(faceOf(7, 2, wall), null, 'the wall below the room is rim');
  assert.equal(faceOf(4, 2, wall), null, 'floor is never a face');
});

test('a face never covers floor: a one-tile wall between two rooms is a lower face only', () => {
  const thin = ['...', '###', '...'];
  const w = (row, col) => row < 0 || row >= thin.length || col < 0 || col >= 3 || thin[row][col] === '#';
  assert.equal(faceOf(1, 1, w), 'lower');
  assert.equal(faceOf(0, 1, w), null);
});

test('the picture scales up by a whole number that still shows enough tiles', () => {
  const s = viewScale(1440, 900);
  assert.ok(Number.isInteger(s) && s >= 1);
  assert.ok(1440 / (s * T) >= ROOM_VIEW.minAcross);
  assert.ok(900 / (s * T) >= ROOM_VIEW.minDown);
  const phone = viewScale(1110, 1700);
  assert.ok(1110 / (phone * T) >= ROOM_VIEW.minAcrossTall, 'a tall map shows fewer tiles across');
  assert.equal(viewScale(100, 100), 1, 'never below 1');
});

test('a room that fits is framed in the middle wherever the player stands', () => {
  const bounds = { x0: 0, x1: 160, y0: 0, y1: 120 };
  const a = cameraGoal(bounds, { x: 10, y: 10 }, 240, 176);
  const b = cameraGoal(bounds, { x: 150, y: 110 }, 240, 176);
  assert.deepEqual(a, b);
  assert.equal(a.x, 80 - 120);
  assert.equal(a.y, 60 - 88);
});

test('a room too big follows the player without showing past its edge; a hallway centres on them', () => {
  const bounds = { x0: 0, x1: 1000, y0: 0, y1: 100 };
  assert.equal(cameraGoal(bounds, { x: 20, y: 50 }, 240, 176).x, 0, 'held at the left edge');
  assert.equal(cameraGoal(bounds, { x: 500, y: 50 }, 240, 176).x, 380, 'the player in the middle');
  assert.equal(cameraGoal(bounds, { x: 990, y: 50 }, 240, 176).x, 760, 'held at the right edge');
  assert.deepEqual(cameraGoal(null, { x: 300, y: 200 }, 240, 176), { x: 180, y: 112 });
});

test('in the room view each arrow walks the way it points on screen, whichever way the body faces', () => {
  assert.equal(padWay(0, -1, 'S', EIGHT, true), 'N');
  assert.equal(padWay(1, 0, 'W', EIGHT, true), 'E');
  assert.equal(padWay(-1, 1, 'N', EIGHT, true), 'SW');
  assert.equal(padWay(1, -1, 'N', ['N', 'E', 'S', 'W'], true), null, 'a corner with 8 ways off');
  assert.equal(padWay(0, -1, 'S', EIGHT, false), 'S', 'the shoulder view still walks round the body');
});

test('every kind of thing the game puts on the map has a room view drawing', async () => {
  const { readFileSync } = await import('node:fs');
  const { ROOM_DRAWINGS } = await import('../js/roomview.js');
  // Props and the floor's other things are made with a `kind: '...'`
  // literal in these files; mapview.js mapThings adds the rest.
  const files = ['decor.js', 'relays.js', 'desk.js', 'tutorial.js', 'floor.js', 'combat.js'];
  const kinds = new Set(['vent', 'coin', 'key', 'stairs', 'player', 'minion', 'hunter', 'boss', 'chest', 'exchange']);
  files.forEach(file => {
    const source = readFileSync(new URL('../js/' + file, import.meta.url), 'utf8');
    for (const [, kind] of source.matchAll(/kind: '([a-z]+)'/g)) kinds.add(kind);
  });
  const ways = new Set(['flat', 'stand', 'form', 'glyph', 'player']);
  kinds.forEach(kind => assert.ok(ways.has(ROOM_DRAWINGS[kind]), `no room view drawing for ${kind}`));
});
