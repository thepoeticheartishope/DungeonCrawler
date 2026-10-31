// Unit tests for the ship (ship plan step A; floor.js buildShipFloor,
// sight.js computeVisibility; the plan's own checks are in
// plans.test.mjs): the player starts in Command, the
// center room, which is the safe room; nothing dangerous goes down; every
// open tile is seen from the start; and another floor built after it is
// not a ship.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { buildShipFloor, buildTestFloor } from '../js/floor.js';
import { walkTileMs } from '../js/walk.js';
import { ONE_STICK } from '../js/config.js';
import { emptyFloor } from './helpers.mjs';

// A fresh run, then the ship.
function shipFloor() {
  emptyFloor(10);
  buildShipFloor();
  return state.floor;
}

test('the player starts in Command, the center room, and it is the safe room', () => {
  const f = shipFloor();
  const room = f.chamberAt.get(key(f.playerRow, f.playerCol));
  assert.equal(f.chamberNames[room], 'plan.ship.command');
  assert.ok(f.safeRoom, 'safe room');
  assert.equal(f.safeRoom.chamber, room);
});

test('the ship holds nothing dangerous and nothing to pick up, only furniture, the stations and the safe room', () => {
  const f = shipFloor();
  assert.equal(f.ship, true);
  assert.deepEqual(f.minions, []);
  assert.equal(f.boss, null);
  assert.equal(f.hunter, null);
  assert.equal(f.stairs, null);
  assert.equal(f.coin, null);
  assert.equal(f.chest, null);
  assert.deepEqual(f.vents, []);
  assert.deepEqual(f.keys, []);
  const kinds = new Set(f.props.map(p => p.kind));
  assert.deepEqual([...kinds].sort(), ['console', 'crew', 'furniture', 'powerBoard', 'shutter', 'switch']);
});

test('every open tile on the ship is seen from the start: no dark areas', () => {
  const f = shipFloor();
  for (let r = 0; r < f.GRID_SIZE; r++) {
    for (let c = 0; c < f.GRID_SIZE; c++) {
      if (!f.wallSet.has(key(r, c))) assert.ok(f.visibleSet.has(key(r, c)), r + ',' + c);
    }
  }
});

test('the ship walk is quicker than the walk elsewhere; a creep is a creep everywhere', () => {
  const f = shipFloor();
  assert.equal(walkTileMs(), ONE_STICK.shipWalkMs);
  assert.ok(ONE_STICK.shipWalkMs < ONE_STICK.walkMs);
  f.creeping = true;
  assert.equal(walkTileMs(), ONE_STICK.sneakMs);
  buildTestFloor('hide');
  state.floor.creeping = false;
  assert.equal(walkTileMs(), ONE_STICK.walkMs);
});

test('a floor built after the ship is not a ship', () => {
  shipFloor();
  buildTestFloor('hide');
  assert.equal(state.floor.ship, false);
});
