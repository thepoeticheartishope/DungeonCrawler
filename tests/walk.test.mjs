// Unit tests for free walking (walk.js, one stick plan steps A and B): the player
// walks at their pace, diagonals as fast as straight lines, slides along a
// wall, never walks into furniture, comes onto each tile once (moves.js
// enterTile), and a push into something bumps it once, then again only
// after ONE_STICK.bumpRepeatMs or a new push. Step B: the light swings
// round by angle at ONE_STICK.turnRate, a key tap or a push in the
// stick's dead zone only turns, and sneaking or a small push creeps.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor } from './helpers.mjs';
import { state, key } from '../js/state.js';
import { ONE_STICK } from '../js/config.js';
import { computeVisibility } from '../js/sight.js';
import { walkFree, freeSpot, resetWalk, switchSneak } from '../js/walk.js';
import { lookAngle, BODY_ANGLES } from '../js/look.js';
import { inLookCone } from '../js/sight.js';

const FRAME = 16;

// An open floor, player in the middle facing north, One stick on.
function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: { oneStick: true, freeLook: false, fogEnabled: true },
    floor: { look: BODY_ANGLES.N },
    see: false,
  });
  resetWalk();
  computeVisibility();
}

// Walks (dx, dy) with `push` for `ms`, a frame at a time (`keys`: held
// move keys, whose first ONE_STICK.tapMs only turn). Returns every event.
function walk(dx, dy, ms, push = 1, keys = false) {
  const events = [];
  for (let t = 0; t < ms; t += FRAME) events.push(...walkFree(dx, dy, { push, dtMs: Math.min(FRAME, ms - t), keys }));
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
  while (!count(events, 'blocked')) events.push(...walkFree(1, 0, { dtMs: FRAME }));
  assert.equal(state.floor.playerCol, col);
  assert.ok(freeSpot().x <= col + 1 - ONE_STICK.body + 1e-9);
  assert.equal(events.find(e => e.type === 'blocked').thing, desk);
  events = walk(1, 0, ONE_STICK.bumpRepeatMs - FRAME * 2);
  assert.equal(count(events, 'blocked'), 0, 'not again at once');
  events = walk(1, 0, FRAME * 3);
  assert.equal(count(events, 'blocked'), 1, 'again after bumpRepeatMs');
  walkFree(0, 0, { dtMs: FRAME });
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

test('the light swings round at ONE_STICK.turnRate, holds when the push stops, and the cone follows', () => {
  resetFloor();
  const { playerRow: row, playerCol: col } = state.floor;
  assert.ok(inLookCone(row - 3, col) && !inLookCone(row, col + 3));
  walk(1, 0, 100, ONE_STICK.deadZone / 2);
  assert.ok(Math.abs(lookAngle() - ONE_STICK.turnRate * 0.1) < 1e-6, 'part way round after 100 ms');
  walk(1, 0, 400, ONE_STICK.deadZone / 2);
  assert.ok(Math.abs(lookAngle() - Math.PI / 2) < 1e-6, 'east');
  assert.equal(state.floor.facing, 'E');
  assert.ok(inLookCone(row, col + 3) && !inLookCone(row - 3, col), 'the cone looks east');
  walk(0, 0, 200);
  assert.ok(Math.abs(lookAngle() - Math.PI / 2) < 1e-6, 'held');
  walkFree(-1, 0, { push: ONE_STICK.deadZone / 2, dtMs: 16, still: true });
  assert.ok(Math.abs(Math.abs(lookAngle()) - Math.PI / 2) < 1e-6 && lookAngle() < 0, 'reduced motion turns at once');
});

test('a key tap or a push in the dead zone only turns; a held key walks', () => {
  resetFloor();
  const start = freeSpot().x;
  walk(1, 0, ONE_STICK.tapMs - FRAME, 1, true);
  walk(0, 0, 300);
  assert.equal(freeSpot().x, start, 'a tap: no step');
  assert.ok(Math.abs(lookAngle() - Math.PI / 2) < 1e-6, 'but turned east');
  walk(1, 0, 300, ONE_STICK.deadZone / 2);
  assert.equal(freeSpot().x, start, 'the dead zone: no step');
  walk(1, 0, 400, 1, true);
  assert.ok(freeSpot().x > start + 0.5, 'a hold walks');
});

test('sneaking (X) creeps at sneakMs a tile, and so does a small push', () => {
  resetFloor();
  assert.equal(switchSneak()[0].on, true);
  const start = freeSpot().x;
  walk(1, 0, ONE_STICK.sneakMs);
  assert.ok(Math.abs(freeSpot().x - start - 1) < 1e-6);
  assert.ok(state.floor.creeping);
  assert.equal(switchSneak()[0].on, false);
  walk(1, 0, ONE_STICK.walkMs);
  assert.ok(Math.abs(freeSpot().x - start - 2) < 1e-6, 'back to the walk');
  assert.ok(!state.floor.creeping);
});
