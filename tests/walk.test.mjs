// Unit tests for free walking (walk.js, one stick plan step A): the player
// walks at their pace, diagonals as fast as straight lines, slides along a
// wall, never walks into furniture, comes onto each tile once (moves.js
// enterTile), and a push into something bumps it once, then again only
// after ONE_STICK.bumpRepeatMs or a new push.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshLight } from '../js/battery.js';
import { state, key } from '../js/state.js';
import { MAX_HEARTS, ONE_STICK } from '../js/config.js';
import { computeVisibility } from '../js/sight.js';
import { resetHaunts } from '../js/haunts.js';
import { walkFree, freeSpot, resetWalk } from '../js/walk.js';

const FRAME = 16;

// An open floor, player in the middle facing north, One stick on.
function resetFloor(size = 21) {
  const f = state.floor;
  f.GRID_SIZE = size;
  f.playerRow = Math.floor(size / 2);
  f.playerCol = Math.floor(size / 2);
  f.playerAt = null;
  f.facing = 'N';
  f.look = null;
  f.darkness = false;
  f.light = freshLight();
  f.wallSet = new Set();
  f.pillarSet = new Set();
  f.bossLitSet = new Set();
  f.exploredSet = new Set();
  f.chamberAt = new Map();
  f.visitedChambers = new Set();
  f.boss = null;
  f.hunter = null;
  f.minions = [];
  f.crawling = [];
  f.vents = [];
  f.keys = [];
  f.coin = null;
  f.stairs = null;
  f.stairsAlt = null;
  f.chest = null;
  f.exchange = null;
  f.tutorial = null;
  f.props = [];
  state.settings.oneStick = true;
  state.settings.freeLook = false;
  state.settings.eightWays = true;
  state.settings.fogEnabled = true;
  state.run.hearts = MAX_HEARTS;
  state.run.coinsTotal = 0;
  state.run.loreQueue = [];
  resetHaunts();
  resetWalk();
  computeVisibility();
}

// Walks (dx, dy) with `push` for `ms`, a frame at a time. Returns every event.
function walk(dx, dy, ms, push = 1) {
  const events = [];
  for (let t = 0; t < ms; t += FRAME) events.push(...walkFree(dx, dy, push, Math.min(FRAME, ms - t)));
  return events;
}
const count = (events, type) => events.filter(e => e.type === type).length;

test('a tile takes ONE_STICK.walkMs, and a diagonal goes as far in the same time', () => {
  resetFloor();
  const start = { ...freeSpot() };
  walk(1, 0, ONE_STICK.walkMs);
  assert.ok(Math.abs(freeSpot().x - start.x - 1) < 1e-6, 'one tile east');
  resetFloor();
  walk(1, 1, ONE_STICK.walkMs);
  const at = freeSpot();
  assert.ok(Math.abs(Math.hypot(at.x - start.x, at.y - start.y) - 1) < 1e-6, 'one tile on the diagonal');
});

test('a small push creeps at ONE_STICK.sneakMs a tile', () => {
  resetFloor();
  const start = freeSpot().x;
  walk(1, 0, ONE_STICK.sneakMs, ONE_STICK.creep / 2);
  assert.ok(Math.abs(freeSpot().x - start - 1) < 1e-6);
});

test('coming onto a new tile counts once, and moves the tile the rules see', () => {
  resetFloor();
  const col = state.floor.playerCol;
  state.floor.coin = { row: state.floor.playerRow, col: col + 1 };
  const events = walk(1, 0, ONE_STICK.walkMs * 0.9);
  assert.equal(state.floor.playerCol, col + 1);
  assert.equal(count(events, 'stepped'), 1);
  assert.ok(events.find(e => e.type === 'stepped').free);
  assert.equal(count(events, 'coinTaken'), 1);
  assert.equal(state.floor.facing, 'E', 'the body turns the way it walks');
});

test('pushing along a wall slides past it without a bump', () => {
  resetFloor();
  const { playerRow: row, playerCol: col } = state.floor;
  for (let c = col - 3; c <= col + 3; c++) state.floor.wallSet.add(key(row - 1, c));
  const events = walk(1, -1, ONE_STICK.walkMs * 2);
  const at = freeSpot();
  assert.equal(state.floor.playerRow, row, 'never into the wall');
  assert.ok(at.y >= row + ONE_STICK.body - 1e-9, 'the body stops at the wall');
  assert.ok(at.x > col + 1.5, 'it slides along');
  assert.equal(count(events, 'blocked'), 0);
});

test('furniture stops the body, and a push bumps it once per ONE_STICK.bumpRepeatMs', () => {
  resetFloor();
  const { playerRow: row, playerCol: col } = state.floor;
  const desk = { kind: 'furniture', piece: 'desk', row, col: col + 1, searched: true };
  state.floor.props.push(desk);
  // Up to the desk: the body stops at it, and the first bump comes.
  let events = [];
  while (!count(events, 'blocked')) events.push(...walkFree(1, 0, 1, FRAME));
  assert.equal(state.floor.playerCol, col);
  assert.ok(freeSpot().x <= col + 1 - ONE_STICK.body + 1e-9);
  assert.equal(events.find(e => e.type === 'blocked').thing, desk);
  events = walk(1, 0, ONE_STICK.bumpRepeatMs - FRAME * 2);
  assert.equal(count(events, 'blocked'), 0, 'not again at once');
  events = walk(1, 0, FRAME * 3);
  assert.equal(count(events, 'blocked'), 1, 'again after bumpRepeatMs');
  walkFree(0, 0, 0, FRAME);
  assert.equal(count(walk(1, 0, FRAME), 'blocked'), 1, 'a new push bumps at once');
});

test('a box in the way is examined, once', () => {
  resetFloor();
  const { playerRow: row, playerCol: col } = state.floor;
  state.floor.props.push({ kind: 'box', row: row - 1, col, loot: 'junk' });
  const events = walk(0, -1, ONE_STICK.walkMs * 3);
  assert.equal(count(events, 'propSearched'), 1);
  assert.equal(state.floor.playerRow, row);
});

test("a downed stick man holding the ankle keeps the player on their tile", () => {
  resetFloor();
  const { playerRow: row, playerCol: col } = state.floor;
  state.floor.minions.push({ row: row + 1, col, downed: true, grabbing: true, hp: 1 });
  const events = walk(-1, 0, ONE_STICK.bumpRepeatMs);
  assert.equal(state.floor.playerCol, col);
  assert.equal(count(events, 'heldFast'), 1);
});

test('a spot off its tile goes back to the tile centre', () => {
  resetFloor();
  state.floor.playerAt = { x: 2.2, y: 3.7 };
  const at = freeSpot();
  assert.deepEqual(at, { x: state.floor.playerCol + 0.5, y: state.floor.playerRow + 0.5 });
});
