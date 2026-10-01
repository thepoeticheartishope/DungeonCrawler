// Unit tests for floor.js buildFloor(): what every new floor must hold,
// checked over many random floors at each depth.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import {
  BOSS_HP, MC_SAMPLE_DATA, LIGHT_TURNS_PER_STEP, PAPERS_PER_ROOM,
} from '../js/config.js';
import { buildFloor } from '../js/floor.js';
import { BEAT_KINDS } from '../js/beats.js';
import { FLOOR_RECIPES } from '../js/floors.js';
import { TEXT } from '../js/text.js';
import { generateDungeonLayout } from '../js/dungeon.js';
import { ROOM_TEMPLATES, parseTemplate } from '../js/rooms.js';

const FLOORS_PER_DEPTH = 15;

function build(roomIndex) {
  state.settings.activeData = MC_SAMPLE_DATA;
  state.run.roomIndex = roomIndex;
  buildFloor();
  return state.floor;
}

// Every depth, many times over, so a rare bad placement still shows up.
function eachFloor(check) {
  FLOOR_RECIPES.forEach((_, roomIndex) => {
    for (let i = 0; i < FLOORS_PER_DEPTH; i++) check(build(roomIndex), roomIndex);
  });
}

function specials(f) {
  return [f.chest, f.rune, ...f.encounters].filter(Boolean);
}

test('grid size and minion count follow the depth', () => {
  eachFloor((f, roomIndex) => {
    assert.equal(f.GRID_SIZE, FLOOR_RECIPES[roomIndex].grid);
    assert.equal(f.minions.length, FLOOR_RECIPES[roomIndex].minions);
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

test('no room holds more than PAPERS_PER_ROOM papers, beat papers included', () => {
  eachFloor((f) => {
    const perRoom = new Map();
    f.props.filter(p => p.kind === 'paper').forEach(p => {
      const room = f.chamberAt.get(key(p.row, p.col));
      perRoom.set(room, (perRoom.get(room) || 0) + 1);
    });
    perRoom.forEach(n => assert.ok(n <= PAPERS_PER_ROOM, n + ' papers in one room'));
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

// A chamber's floor without its doors out, which turning and mirroring
// don't change: the drawing's floor minus its edge doors.
function innerTiles(chamber, name) {
  const tpl = parseTemplate(ROOM_TEMPLATES.find(t => t.name === name).rows);
  const openDoors = chamber.doorKeys.size - tpl.innerDoors.length;
  return { got: chamber.floorCells.length - openDoors, want: tpl.floor.length - tpl.doors.length };
}

test('the recipe\'s start and boss rooms are the named drawings', () => {
  FLOOR_RECIPES.forEach(recipe => {
    for (let i = 0; i < FLOORS_PER_DEPTH; i++) {
      const layout = generateDungeonLayout(recipe.grid, recipe.rooms, recipe.loops,
        { startRoom: recipe.startRoom, bossRoom: recipe.bossRoom });
      assert.ok(layout.chambers.length > 1, 'fell back to the one-room floor');
      const start = layout.chambers[layout.chamberAt.get(key(layout.start.row, layout.start.col))];
      const boss = layout.chambers[layout.chamberAt.get(key(layout.spawn.row, layout.spawn.col))];
      assert.equal(start.name, recipe.startRoom);
      assert.ok(boss.isBoss);
      assert.equal(boss.name, recipe.bossRoom);
      [[start, recipe.startRoom], [boss, recipe.bossRoom]].forEach(([ch, name]) => {
        const { got, want } = innerTiles(ch, name);
        assert.equal(got, want, name + ' is not its drawing');
      });
      const others = layout.chambers.filter(ch => ch !== start && ch !== boss);
      others.forEach(ch => assert.equal(ch.name, null, 'a named room was dealt at random'));
    }
  });
});

test('each floor adds its story to the end of the run queue, and every line has wording', () => {
  state.run.loreQueue = ['story.left.unread'];
  build(0);
  assert.deepEqual(state.run.loreQueue, ['story.left.unread', ...FLOOR_RECIPES[0].lore]);
  FLOOR_RECIPES.forEach(r => (r.lore || []).forEach(k => assert.ok(k in TEXT, k)));
  state.run.loreQueue = [];
});

test('every recipe\'s beats are known kinds, with no more minion beats than minions', () => {
  FLOOR_RECIPES.forEach(r => {
    (r.beats || []).forEach(kind => assert.ok(BEAT_KINDS.includes(kind), kind));
    assert.ok((r.beats || []).filter(kind => kind === 'minion').length <= r.minions);
  });
});

// Whether the paper, box, minion or special a beat asked for stands on
// its tile when the floor is built.
function beatThere(f, beat) {
  const on = p => p && p.row === beat.row && p.col === beat.col;
  if (beat.kind === 'paper' || beat.kind === 'box') return f.props.some(p => p.kind === beat.kind && on(p));
  if (beat.kind === 'minion') return f.minions.some(on);
  return specials(f).some(on);
}

test('beats land in rooms along the walk to the boss, in the recipe\'s order', () => {
  let wanted = 0;
  let placed = 0;
  eachFloor((f, roomIndex) => {
    const recipe = FLOOR_RECIPES[roomIndex];
    wanted += recipe.beats.length;
    placed += f.beats.length;
    // The beats that landed are the recipe's list with at most a few left
    // out, never swapped.
    let next = 0;
    f.beats.forEach((beat, i) => {
      while (next < recipe.beats.length && recipe.beats[next] !== beat.kind) next++;
      assert.ok(next < recipe.beats.length, 'beat out of order: ' + beat.kind);
      next++;
      assert.ok(f.chamberAt.has(key(beat.row, beat.col)), 'beat in a hallway');
      assert.ok(beatThere(f, beat), beat.kind + ' missing from its tile');
      if (i > 0) assert.ok(beat.at >= f.beats[i - 1].at, 'beat earlier on the walk than the one before');
    });
  });
  // A crowded floor may drop a beat now and then, but almost all land.
  assert.ok(placed / wanted > 0.95, 'only ' + placed + ' of ' + wanted + ' beats landed');
});

test('the light leaves each floor the slack its recipe asks for', () => {
  eachFloor((f, roomIndex) => {
    const [min, max] = FLOOR_RECIPES[roomIndex].slack;
    const walk = f.bossDist.get(key(f.PLAYER_START.row, f.PLAYER_START.col));
    assert.equal(f.lightSlack, f.lightTurnBudget - walk);
    // The budget rounds up to whole light steps, so slack can run a few turns over.
    assert.ok(f.lightSlack >= min && f.lightSlack < max + LIGHT_TURNS_PER_STEP,
      `floor ${roomIndex + 1}: slack ${f.lightSlack} outside ${min}-${max}`);
    assert.ok(f.lightLossShare > 0 && f.lightLossShare <= 1);
  });
});

test('a recipe without slack falls back to its loss share', () => {
  const recipe = FLOOR_RECIPES[0];
  const saved = recipe.slack;
  delete recipe.slack;
  recipe.lossCoverage = 0.5;
  try {
    const f = build(0);
    assert.ok(f.lightLossShare >= 0.5, `loss share ${f.lightLossShare} below 0.5`);
  } finally {
    recipe.slack = saved;
    delete recipe.lossCoverage;
  }
});

test('every floor built counts as a new floor, even the same depth again', () => {
  const before = state.run.floorsEntered;
  build(0);
  build(0);
  build(1);
  assert.equal(state.run.floorsEntered, before + 3);
});
