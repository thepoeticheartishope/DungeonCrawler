// Unit tests for vents.js (vents and noise plan step A): where grates go
// on a floor, and the player walking over them.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { MC_SAMPLE_DATA, VENT_PAIRS, VENT_MIN_APART } from '../js/config.js';
import { buildFloor, buildRestFloor } from '../js/floor.js';
import { FLOOR_RECIPES } from '../js/floors.js';
import { whatBlocks } from '../js/passage.js';
import { stepPlayer } from '../js/moves.js';
import { neighbors } from '../js/combat.js';

const FLOORS_PER_DEPTH = 15;

function build(roomIndex) {
  state.settings.activeData = MC_SAMPLE_DATA;
  state.run.roomIndex = roomIndex;
  state.run.resting = false;
  buildFloor();
  return state.floor;
}

// Every depth, many times over, so a rare bad placement still shows up.
function eachFloor(check) {
  FLOOR_RECIPES.forEach((_, roomIndex) => {
    for (let i = 0; i < FLOORS_PER_DEPTH; i++) check(build(roomIndex));
  });
}

// Walking steps between two tiles, the way stick men walk.
function steps(f, from, to) {
  const blocked = new Set(f.wallSet);
  const dist = new Map([[key(from.row, from.col), 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.row === to.row && cur.col === to.col) return dist.get(key(cur.row, cur.col));
    for (const [row, col] of neighbors(cur.row, cur.col)) {
      const k = key(row, col);
      if (dist.has(k) || blocked.has(k)) continue;
      dist.set(k, dist.get(key(cur.row, cur.col)) + 1);
      queue.push({ row, col });
    }
  }
  return Infinity;
}

test('every floor gets its pairs, each joining two rooms far apart', () => {
  eachFloor(f => {
    assert.equal(f.vents.length, VENT_PAIRS * 2);
    f.vents.forEach((v, i) => {
      assert.equal(f.vents[v.pair].pair, i, 'pairs point at each other');
      assert.equal(v.known, false);
    });
    f.vents.filter((v, i) => i < v.pair).forEach(v => {
      assert.ok(steps(f, v, f.vents[v.pair]) >= VENT_MIN_APART, 'far apart on foot');
    });
  });
});

test('never in the start room, the core, a doorway, or under anything', () => {
  eachFloor(f => {
    const startRoom = f.chamberAt.get(key(f.PLAYER_START.row, f.PLAYER_START.col));
    const rooms = f.vents.map(v => f.chamberAt.get(key(v.row, v.col)));
    // The stairs are behind the gate, in the core.
    const coreRoom = f.chamberAt.get(key(f.stairs.row, f.stairs.col));
    assert.notEqual(coreRoom, undefined);
    assert.equal(new Set(rooms).size, rooms.length, 'one grate a room');
    f.vents.forEach((v, i) => {
      assert.notEqual(rooms[i], undefined, 'on room floor');
      assert.notEqual(rooms[i], startRoom, 'not the start room');
      assert.ok(!f.doorSet.has(key(v.row, v.col)), 'not a doorway');
      assert.equal(whatBlocks(v.row, v.col), null, 'walkable, nothing on it');
      assert.ok(!f.props.some(p => p.row === v.row && p.col === v.col), 'no paper on it either');
      assert.ok(!f.keys.some(p => p.row === v.row && p.col === v.col), 'no key on it');
      assert.notEqual(rooms[i], coreRoom, 'not the core');
    });
  });
});

test('rest floors have no grates', () => {
  build(0);
  buildRestFloor('between');
  assert.deepEqual(state.floor.vents, []);
});

test('stepping onto a grate says so, as part of the step', () => {
  const f = build(0);
  const v = f.vents[0];
  // Stand beside it, then step on.
  const [row, col] = neighbors(v.row, v.col).find(([r, c]) => !whatBlocks(r, c) && !f.wallSet.has(key(r, c)));
  f.playerRow = row;
  f.playerCol = col;
  const events = stepPlayer(v.row - row, v.col - col);
  const types = events.map(e => e.type);
  assert.ok(types.includes('stepped'));
  assert.ok(types.includes('ventStepped'));
  assert.deepEqual([f.playerRow, f.playerCol], [v.row, v.col]);
});
