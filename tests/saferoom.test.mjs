// Unit tests for saferoom.js (safe room plan step A): where the shutters
// and switch go, up = open floor and down = solid, stick men kept out,
// stopping at an open door, giving up at a shut one, the hunter lifting
// it, a reach broken at the doorway, static, the lamp, and no energy cells.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { MC_SAMPLE_DATA, SAFE_ROOM } from '../js/config.js';
import { buildFloor, buildRestFloor, buildTutorialFloor } from '../js/floor.js';
import { FLOOR_RECIPES } from '../js/floors.js';
import { pullShutter, inSafeRoom } from '../js/saferoom.js';
import { whatBlocks } from '../js/passage.js';
import { advanceMonsters, clockFrame, spawnMinion, tileOccupied, blockedTilesFor, bfsPath } from '../js/combat.js';
import { keptOut } from '../js/relays.js';
import { clearLine, computeVisibility } from '../js/sight.js';
import { enterTile } from '../js/moves.js';
import { staticLevel } from '../js/static.js';
import { breakGate } from '../js/gate.js';

SAFE_ROOM.on = true;
const DEPTHS = FLOOR_RECIPES.map((_, i) => i);
const turns = (ms) => Math.round(ms / SAFE_ROOM.turnMs);

// A danger floor at `depth`, on the turn game's rules (One stick has its
// own test below).
function build(depth = 0) {
  state.settings.oneStick = false;
  state.settings.activeData = MC_SAMPLE_DATA;
  state.settings.staticNoise = true;
  state.run.roomIndex = depth;
  state.run.resting = false;
  state.run.hearts = state.run.maxHearts = 5;
  buildFloor();
  return state.floor;
}

const parse = (k) => { const [row, col] = k.split(',').map(Number); return { row, col }; };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// A doorway of the safe room, the hall tile outside it, and the room tile
// farthest from it that nothing stands on, with the floor's own stick men
// cleared away and the player put on that far tile.
function atTheDoor(f) {
  const door = parse(f.safeRoom.doors[0]);
  const [dr, dc] = DIRS.find(([r, c]) => {
    const k = key(door.row + r, door.col + c);
    return !f.wallSet.has(k) && !f.safeRoom.cells.has(k);
  });
  const outside = { row: door.row + dr, col: door.col + dc };
  const far = [...f.safeRoom.cells].map(parse)
    .filter(p => !f.safeRoom.doors.includes(key(p.row, p.col)))
    .filter(p => !tileOccupied(p.row, p.col) || (p.row === f.playerRow && p.col === f.playerCol))
    .sort((a, b) => Math.hypot(b.row - door.row, b.col - door.col) - Math.hypot(a.row - door.row, a.col - door.col))[0];
  f.minions = [];
  f.playerRow = far.row;
  f.playerCol = far.col;
  computeVisibility();
  return { door, outside, far };
}

// A SHARD outside the doorway that knows where the player is.
function shardOutside(f, outside) {
  const m = spawnMinion(outside, 'SHARD');
  m.lastSeen = { row: f.playerRow, col: f.playerCol };
  m.track = 5;
  return m;
}

const on = (m, p) => m.row === p.row && m.col === p.col;

test('every depth gets a shutter on each doorway of the start room and a switch inside', () => {
  DEPTHS.forEach(depth => {
    for (let i = 0; i < 10; i++) {
      const f = build(depth);
      const sr = f.safeRoom;
      assert.ok(sr, `depth ${depth}: no safe room`);
      assert.ok(sr.cells.has(key(f.PLAYER_START.row, f.PLAYER_START.col)), 'the player starts in it');
      const shutters = f.props.filter(p => p.kind === 'shutter');
      assert.deepEqual(shutters.map(p => key(p.row, p.col)).sort(), [...sr.doors].sort());
      assert.ok(shutters.every(p => p.up), 'they start up');
      // A doorway leads out: open floor outside the room beside it.
      sr.doors.map(parse).forEach(d => assert.ok(DIRS.some(([dr, dc]) => {
        const k = key(d.row + dr, d.col + dc);
        return !f.wallSet.has(k) && !sr.cells.has(k);
      })));
      const sw = f.props.filter(p => p.kind === 'switch');
      assert.equal(sw.length, 1);
      assert.ok(sr.cells.has(key(sw[0].row, sw[0].col)), 'the switch is inside');
      assert.ok(!sr.doors.includes(key(sw[0].row, sw[0].col)), 'never in a doorway');
      assert.ok(DIRS.some(([dr, dc]) => f.wallSet.has(key(sw[0].row + dr, sw[0].col + dc))), 'on a wall');
      if (FLOOR_RECIPES[depth].plan === 'observatory') assert.equal(sr.doors.length, 2, 'the lobby has two doorways');
    }
  });
});

test('nothing else lands on a doorway, and no energy cell lands in the safe room', () => {
  DEPTHS.forEach(depth => {
    for (let i = 0; i < 10; i++) {
      const f = build(depth);
      const doors = new Set(f.safeRoom.doors);
      f.props.filter(p => p.kind !== 'shutter').forEach(p => assert.ok(!doors.has(key(p.row, p.col)), `${p.kind} on a doorway`));
      f.minions.forEach(m => assert.ok(!inSafeRoom(m.row, m.col), 'no stick man starts in it'));
      f.props.filter(p => p.kind === 'cell').forEach(p => assert.ok(!inSafeRoom(p.row, p.col), 'an energy cell in it'));
      (f.vents || []).forEach(v => assert.ok(!inSafeRoom(v.row, v.col), 'a grate in it'));
    }
  });
});

test('no safe room on a rest floor or the tutorial', () => {
  ['opening', 'between', 'epilogue'].forEach(kind => {
    build(0);
    buildRestFloor(kind);
    assert.equal(state.floor.safeRoom, null);
    assert.ok(!state.floor.props.some(p => p.kind === 'shutter' || p.kind === 'switch'));
  });
  build(0);
  buildTutorialFloor();
  assert.equal(state.floor.safeRoom, null);
});

test('an up shutter is open floor; down it is solid, blocks sight, and a bump lifts it', () => {
  const f = build(0);
  const { door, outside } = atTheDoor(f);
  assert.equal(whatBlocks(door.row, door.col), null);
  assert.equal(tileOccupied(door.row, door.col), false);
  assert.deepEqual(pullShutter(), [{ type: 'shutterDown' }]);
  const block = whatBlocks(door.row, door.col);
  assert.equal(block.kind, 'prop');
  assert.equal(block.thing.kind, 'shutter');
  assert.equal(tileOccupied(door.row, door.col), true);
  assert.equal(clearLine(outside.row, outside.col, f.playerRow, f.playerCol), false);
  computeVisibility();
  assert.ok(!f.sightSet.has(key(outside.row, outside.col)), 'the light stops at it');
  assert.ok(!f.sightSet.has(key(door.row, door.col)), 'its lit face draws no one');
  assert.deepEqual(pullShutter(), [{ type: 'shutterUp' }]);
  assert.equal(whatBlocks(door.row, door.col), null);
});

test('the shutter won\'t drop on the player or a stick man in the doorway', () => {
  const f = build(0);
  const { door, outside, far } = atTheDoor(f);
  f.playerRow = door.row;
  f.playerCol = door.col;
  assert.deepEqual(pullShutter(), [{ type: 'shutterBlocked' }]);
  f.playerRow = far.row;
  f.playerCol = far.col;
  const m = spawnMinion(door, 'SHARD');
  assert.deepEqual(pullShutter(), [{ type: 'shutterBlocked' }]);
  m.row = outside.row;
  m.col = outside.col;
  assert.deepEqual(pullShutter(), [{ type: 'shutterDown' }]);
});

test('down, a stick man outside is kept out; one already inside stays', () => {
  const f = build(0);
  const { outside, far } = atTheDoor(f);
  const m = shardOutside(f, outside);
  pullShutter();
  assert.ok(keptOut(m).has(key(far.row, far.col)));
  assert.equal(bfsPath(m, far, blockedTilesFor(m)), null);
  m.row = far.row;
  m.col = far.col;
  assert.equal(keptOut(m).size, 0);
});

test('at an open doorway a stick man stops about 1.5 s, then comes in', () => {
  const f = build(0);
  const { door, outside } = atTheDoor(f);
  const m = shardOutside(f, outside);
  const wait = turns(SAFE_ROOM.hesitateMs);
  for (let i = 0; i < wait; i++) {
    advanceMonsters();
    assert.ok(on(m, outside), `stepped in after ${i + 1} turns`);
  }
  advanceMonsters();
  assert.ok(on(m, door), 'it came in');
});

test('one stick: the stop at the doorway is real time', () => {
  const f = build(0);
  state.settings.oneStick = true;
  const { door, outside } = atTheDoor(f);
  const m = shardOutside(f, outside);
  let ms = 0, stopped = null;
  while (!on(m, door) && ms < 10000) {
    clockFrame(50, { canStruggle: false });
    ms += 50;
    if (m.atDoor && stopped === null) stopped = ms;
  }
  assert.ok(stopped !== null, 'it stopped');
  assert.ok(ms - stopped >= SAFE_ROOM.hesitateMs, `in after ${ms - stopped} ms`);
  assert.ok(ms - stopped < SAFE_ROOM.hesitateMs + 1000, `in after ${ms - stopped} ms`);
});

test('shut out, a stick man waits at the shutter about 3 s, then gives up and wanders', () => {
  const f = build(0);
  const { outside } = atTheDoor(f);
  const m = shardOutside(f, outside);
  pullShutter();
  const first = advanceMonsters();
  assert.ok(first.some(e => e.type === 'shutterWaited' && e.minion === m));
  for (let i = 1; i < turns(SAFE_ROOM.waitMs); i++) {
    const events = advanceMonsters();
    assert.ok(!events.some(e => e.type === 'shutterGaveUp'), `gave up after ${i + 1} turns`);
    assert.ok(on(m, outside), 'it waits at the shutter');
  }
  const last = advanceMonsters();
  assert.ok(last.some(e => e.type === 'shutterGaveUp' && e.minion === m));
  assert.equal(m.lastSeen, null);
  assert.equal(m.track, 0);
  for (let i = 0; i < 30; i++) {
    const events = advanceMonsters();
    assert.ok(!events.some(e => e.type === 'shutterWaited'), 'it doesn\'t come back to wait');
    assert.ok(!inSafeRoom(m.row, m.col), 'it never gets in');
  }
});

test('the hunter lifts a shut shutter after about 2.5 s, and it stays up', () => {
  const f = build(0);
  const { outside } = atTheDoor(f);
  const h = spawnMinion(outside, null);
  h.kind = 'hunter';
  h.rest = 0;
  f.hunter = h;
  pullShutter();
  const first = advanceMonsters();
  assert.ok(first.some(e => e.type === 'shutterLifting'));
  assert.ok(on(h, outside));
  for (let i = 1; i < turns(SAFE_ROOM.hunterLiftMs); i++) {
    advanceMonsters();
    assert.equal(f.safeRoom.shut, true, `lifted after ${i + 1} turns`);
  }
  const last = advanceMonsters();
  assert.ok(last.some(e => e.type === 'shutterLifted'));
  assert.equal(f.safeRoom.shut, false);
  assert.ok(f.props.filter(p => p.kind === 'shutter').every(p => p.up));
});

test('crossing into the safe room breaks a reach', () => {
  const f = build(0);
  const { door, outside } = atTheDoor(f);
  f.playerRow = outside.row;
  f.playerCol = outside.col;
  f.safeRoom.playerIn = false;
  const m = spawnMinion({ row: outside.row + (outside.row - door.row), col: outside.col + (outside.col - door.col) }, 'SHARD');
  m.reaching = { left: 300, ms: 600 };
  f.playerRow = door.row;
  f.playerCol = door.col;
  const events = enterTile('N');
  assert.ok(events.some(e => e.type === 'reachBroken' && e.minion === m));
  assert.equal(m.reaching, null);
  // Already inside, a further step breaks nothing.
  m.reaching = { left: 300, ms: 600 };
  assert.ok(!enterTile('N').some(e => e.type === 'reachBroken'));
});

test('shut in, the static is 0 however close a stick man is', () => {
  const f = build(0);
  const { door, outside } = atTheDoor(f);
  f.playerRow = door.row - (outside.row - door.row);
  f.playerCol = door.col - (outside.col - door.col);
  spawnMinion(outside, 'SHARD');
  assert.ok(staticLevel() > 0);
  pullShutter();
  assert.equal(staticLevel(), 0);
});

test('the lamp goes out when the boss falls', () => {
  const f = build(0);
  assert.equal(f.safeRoom.lamp, true);
  const events = breakGate();
  assert.equal(f.safeRoom.lamp, false);
  assert.ok(events.some(e => e.type === 'lampWentOut'));
});

test('with SAFE_ROOM off a floor has no safe room', () => {
  SAFE_ROOM.on = false;
  try {
    const f = build(0);
    assert.equal(f.safeRoom, null);
    assert.ok(!f.props.some(p => p.kind === 'shutter' || p.kind === 'switch'));
  } finally {
    SAFE_ROOM.on = true;
  }
});
