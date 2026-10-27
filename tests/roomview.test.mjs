// Unit tests for the room view (js/roomview.js, room view plan step A):
// which wall tiles show a face, how far the picture is scaled up, where the
// camera frames a room or follows the player, and the d-pad's ways when
// the eye in the sky opening with the boss's light; every kind of thing on the map
// has a drawing (step B, stick men step C).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROOM_VIEW } from '../js/config.js';
import { faceOf, viewScale, cameraGoal } from '../js/roomview.js';


const T = ROOM_VIEW.tilePx;

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

test('the eye in the sky opens with the boss light and is shut with none', async () => {
  const { state } = await import('../js/state.js');
  const { skyEyeOpen, skyTurnsLeft } = await import('../js/mapshared.js');
  // In turns (the start screen's Turns option); beat.test.mjs has One stick's seconds.
  state.settings.oneStick = false;
  state.floor.tutorial = null;
  state.floor.boss = { row: 1, col: 1 };
  state.floor.lightTurnBudget = 40;
  state.floor.lightTurns = 0;
  assert.equal(skyEyeOpen(), 0);
  assert.equal(skyTurnsLeft(), 40);
  state.floor.lightTurns = 10;
  const quarter = skyEyeOpen();
  state.floor.lightTurns = 30;
  const most = skyEyeOpen();
  assert.ok(quarter > 0 && quarter < most && most < 1, 'it opens as the light spreads');
  state.floor.lightTurns = 40;
  assert.equal(skyEyeOpen(), 1);
  state.floor.boss = null; // a rest floor, or the boss has fallen
  assert.equal(skyEyeOpen(), 0);
  assert.equal(skyTurnsLeft(), null);
});

test('every kind of thing the game puts on the map has a room view drawing', async () => {
  const { readFileSync } = await import('node:fs');
  const { ROOM_DRAWINGS } = await import('../js/roomview.js');
  // Props and the floor's other things are made with a `kind: '...'`
  // literal in these files; mapview.js mapThings adds the rest.
  const files = ['decor.js', 'relays.js', 'desk.js', 'charger.js', 'tutorial.js', 'floor.js', 'combat.js'];
  const kinds = new Set(['vent', 'coin', 'key', 'stairs', 'player', 'minion', 'hunter', 'boss', 'chest', 'exchange']);
  files.forEach(file => {
    const source = readFileSync(new URL('../js/' + file, import.meta.url), 'utf8');
    for (const [, kind] of source.matchAll(/kind: '([a-z]+)'/g)) kinds.add(kind);
  });
  const ways = new Set(['flat', 'stand', 'form', 'glyph', 'player']);
  kinds.forEach(kind => assert.ok(ways.has(ROOM_DRAWINGS[kind]), `no room view drawing for ${kind}`));
});

test('every furniture piece has a room view drawing', async () => {
  const { FURNITURE_PIECES } = await import('../js/config.js');
  const source = (await import('node:fs')).readFileSync(new URL('../js/roomview.js', import.meta.url), 'utf8');
  const table = source.slice(source.indexOf('const PIECES = {'));
  FURNITURE_PIECES.forEach(piece => assert.ok(new RegExp('\\b' + piece + ':').test(table), 'no drawing for ' + piece));
});
