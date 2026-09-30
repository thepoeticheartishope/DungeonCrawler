// Unit tests for floor.js buildFloor(): what every new floor must hold,
// checked over many random floors at each depth.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import {
  GRID_SIZES, MINIONS_PER_ROOM, BOSS_HP, MC_SAMPLE_DATA,
} from '../js/config.js';
import { buildFloor } from '../js/floor.js';

const FLOORS_PER_DEPTH = 15;

function build(roomIndex) {
  state.settings.activeData = MC_SAMPLE_DATA;
  state.run.roomIndex = roomIndex;
  buildFloor();
  return state.floor;
}

// Every depth, many times over, so a rare bad placement still shows up.
function eachFloor(check) {
  GRID_SIZES.forEach((_, roomIndex) => {
    for (let i = 0; i < FLOORS_PER_DEPTH; i++) check(build(roomIndex), roomIndex);
  });
}

function specials(f) {
  return [f.chest, f.rune, ...f.encounters].filter(Boolean);
}

test('grid size and minion count follow the depth', () => {
  eachFloor((f, roomIndex) => {
    assert.equal(f.GRID_SIZE, GRID_SIZES[roomIndex]);
    assert.equal(f.minions.length, MINIONS_PER_ROOM[roomIndex]);
  });
});

test('player starts on PLAYER_START facing north; boss has full HP', () => {
  eachFloor(f => {
    assert.equal(f.playerRow, f.PLAYER_START.row);
    assert.equal(f.playerCol, f.PLAYER_START.col);
    assert.equal(f.facing, 'N');
    assert.equal(f.boss.hp, BOSS_HP);
    assert.ok(f.stairs);
  });
});

test('at most one special item: a chest, a rune or one encounter', () => {
  eachFloor(f => assert.ok(specials(f).length <= 1));
});

test('nothing shares a tile or sits in a wall or pillar', () => {
  eachFloor(f => {
    const things = [
      { row: f.playerRow, col: f.playerCol }, f.boss, f.stairs,
      f.coin, ...specials(f), ...f.minions,
    ].filter(Boolean);
    const tiles = things.map(p => key(p.row, p.col));
    assert.equal(new Set(tiles).size, tiles.length, 'two things on one tile');
    tiles.forEach(k => {
      assert.ok(!f.wallSet.has(k), 'thing in a wall: ' + k);
      assert.ok(!f.pillarSet.has(k), 'thing in a pillar: ' + k);
    });
  });
});

test('coin and special item land in rooms, never hallways', () => {
  eachFloor(f => {
    [f.coin, ...specials(f)].filter(Boolean).forEach(p => {
      assert.ok(f.chamberAt.has(key(p.row, p.col)), 'in a hallway: ' + key(p.row, p.col));
    });
  });
});

test('minions start in rooms, not next to the player', () => {
  eachFloor(f => {
    f.minions.forEach(m => {
      assert.ok(f.chamberAt.has(key(m.row, m.col)), 'minion in a hallway');
      const touching = Math.abs(m.row - f.playerRow) + Math.abs(m.col - f.playerCol) <= 1;
      assert.ok(!touching, 'minion next to the player at start');
    });
  });
});

test('a new floor forgets the old one', () => {
  build(0);
  state.floor.hunter = { row: 1, col: 1 };
  state.floor.darkness = true;
  state.floor.darkTurns = 7;
  state.floor.runeHint = 'x';
  state.floor.exploredSet.add('1,1');
  const f = build(1);
  assert.equal(f.hunter, null);
  assert.equal(f.darkness, false);
  assert.equal(f.darkTurns, 0);
  assert.equal(f.runeHint, null);
  assert.ok(!f.exploredSet.has('1,1') || f.visibleSet.has('1,1'));
});

test('the start room counts as visited and the player can see', () => {
  eachFloor(f => {
    const start = f.chamberAt.get(key(f.playerRow, f.playerCol));
    if (start !== undefined) assert.ok(f.visitedChambers.has(start));
    assert.ok(f.visibleSet.has(key(f.playerRow, f.playerCol)));
  });
});
