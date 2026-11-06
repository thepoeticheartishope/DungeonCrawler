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
import { buildShipFloor } from '../js/floor.js';
import { walkTileMs } from '../js/walk.js';
import { enterTile, bumpInto } from '../js/moves.js';
import { whatBlocks } from '../js/passage.js';
import { parseKey } from '../js/state.js';
import { SHIP_DOOR_REACH } from '../js/config.js';
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
  const kinds = new Set(f.props.map(p => p.kind));
  assert.deepEqual([...kinds].sort(), ['console', 'crew', 'furniture', 'powerBoard', 'shutter']);
});

test('every open tile on the ship is seen from the start: no dark areas', () => {
  const f = shipFloor();
  for (let r = 0; r < f.GRID_SIZE; r++) {
    for (let c = 0; c < f.GRID_SIZE; c++) {
      if (!f.wallSet.has(key(r, c))) assert.ok(f.visibleSet.has(key(r, c)), r + ',' + c);
    }
  }
});

test('the ship walk is quicker than the old walk; a creep is a creep on the ship too', () => {
  const f = shipFloor();
  assert.equal(walkTileMs(), ONE_STICK.shipWalkMs);
  assert.ok(ONE_STICK.shipWalkMs < ONE_STICK.walkMs);
  f.creeping = true;
  assert.equal(walkTileMs(), ONE_STICK.sneakMs);
});

// Timothy 2026-11-02: Command's shutters are automatic doors, with no switch
// and nothing to bump (saferoom.js autoShutters).
// Puts the player on (row, col) as a step there would.
function standAt(row, col) {
  state.floor.playerRow = row;
  state.floor.playerCol = col;
  return enterTile('S');
}

test('the ship has no switch, and its shutters start down with the player far from them', () => {
  const f = shipFloor();
  assert.ok(!f.props.some(p => p.kind === 'switch'));
  assert.equal(f.safeRoom.shut, true);
  assert.ok(f.props.filter(p => p.kind === 'shutter').every(p => !p.up));
});

test('a ship shutter rolls up as the player walks near it and drops as they walk away', () => {
  const f = shipFloor();
  const door = parseKey(f.safeRoom.doors[0]);
  const shutter = f.props.find(p => p.kind === 'shutter' && p.row === door.row && p.col === door.col);
  // Just in reach, inside the room, then in the doorway itself.
  standAt(door.row - SHIP_DOOR_REACH, door.col);
  assert.equal(f.safeRoom.shut, false);
  assert.equal(shutter.up, true);
  assert.equal(whatBlocks(door.row, door.col), null, 'an up shutter is open floor');
  standAt(door.row, door.col);
  assert.equal(shutter.up, true, 'never drops on the player');
  // Out of reach again.
  standAt(door.row - SHIP_DOOR_REACH - 1, door.col);
  assert.equal(f.safeRoom.shut, true);
  assert.equal(shutter.up, false);
});

test('bumping a ship shutter does nothing: it is automatic', () => {
  const f = shipFloor();
  const door = parseKey(f.safeRoom.doors[0]);
  const shutter = f.props.find(p => p.kind === 'shutter' && p.row === door.row && p.col === door.col);
  const events = bumpInto({ kind: 'prop', thing: shutter });
  assert.ok(!events.some(e => e.type === 'shutterUp' || e.type === 'shutterDown'));
  assert.equal(f.safeRoom.shut, true);
});
