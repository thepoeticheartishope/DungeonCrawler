// Unit tests for the ship's furniture file (rooms/ship.json, rooms.js;
// room sprites plan step A): the file matches plans.js, so the ship looks
// the same; bad entries are skipped, never fatal; a piece off its room's
// floor is left out with a warning.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { applyRoomFurniture } from '../js/rooms.js';
import { makePlacer, placeFurniture } from '../js/decor.js';
import { FURNITURE_PIECES } from '../js/config.js';

const file = JSON.parse(readFileSync(new URL('../rooms/ship.json', import.meta.url)));
const copyPlan = () => structuredClone(FLOOR_PLANS.ship);

// Pieces with a PNG and no code art (sprites/sprites.json, room sprites
// plan step B, e.g. the chicken): only in the file, never in plans.js.
const sprites = JSON.parse(readFileSync(new URL('../sprites/sprites.json', import.meta.url)));
const spriteOnly = ([piece]) => sprites.pieces[piece] && !FURNITURE_PIECES.includes(piece);

test('rooms/ship.json has the same rooms and furniture as plans.js, plus sprite-only pieces', () => {
  const plan = FLOOR_PLANS.ship;
  assert.deepEqual(file.rooms.map(r => r.name), plan.rooms.map(r => r.name));
  file.rooms.forEach((r, i) => {
    const room = plan.rooms[i];
    assert.deepEqual([r.r0, r.c0, r.r1, r.c1], [room.r0, room.c0, room.r1, room.c1]);
    assert.deepEqual(r.furniture.filter(p => !spriteOnly(p)), room.furniture);
  });
  assert.deepEqual(applyRoomFurniture(copyPlan(), file), []);
});

test('a moved piece moves', () => {
  const plan = copyPlan();
  const data = structuredClone(file);
  data.rooms[0].furniture[0] = ['desk', 14, 14];
  applyRoomFurniture(plan, data);
  assert.deepEqual(plan.rooms[0].furniture[0], ['desk', 14, 14]);
});

test('bad entries are skipped, not fatal', () => {
  const plan = copyPlan();
  const before = structuredClone(plan.rooms[1].furniture);
  const warnings = applyRoomFurniture(plan, { rooms: [
    { name: 'plan.ship.nowhere', furniture: [] },
    { name: plan.rooms[0].name, furniture: [['desk', 15, 13], ['desk', 'x', 1], 'sofa', ['bench', 1, 1, 0]] },
    { name: plan.rooms[1].name },
  ] });
  assert.equal(warnings.length, 5);
  assert.deepEqual(plan.rooms[0].furniture, [['desk', 15, 13]]);
  assert.deepEqual(plan.rooms[1].furniture, before);
  assert.equal(applyRoomFurniture(copyPlan(), null).length, 1);
  assert.equal(applyRoomFurniture(copyPlan(), { nope: 1 }).length, 1);
});

test('a piece off its room floor is left out with a warning', () => {
  const plan = copyPlan();
  const room = plan.rooms[0];
  room.furniture = [['desk', room.r0, room.c0 - 1], ['desk', 15, 13]];
  const layout = buildPlanLayout(plan);
  const warnings = [];
  const pieces = placeFurniture(layout, makePlacer(layout, plan.rows.length), w => warnings.push(w));
  assert.ok(pieces.some(p => p.row === 15 && p.col === 13));
  assert.ok(!pieces.some(p => p.row === room.r0 && p.col === room.c0 - 1));
  assert.equal(warnings.length, 1);
});
