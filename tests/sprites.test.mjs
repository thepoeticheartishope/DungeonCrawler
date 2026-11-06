// Unit tests for the furniture sprites (sprites/sprites.json, sprites.js;
// room sprites plan step B): every PNG the file names is there and the
// right size; every piece the ship's rooms use has a drawing (a PNG or code
// art); the sample chicken stands in the Galley; bad lines and wrong-size
// PNGs are turned away, never fatal.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FURNITURE_PIECES, FURNITURE_SPRITES } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { applyRoomFurniture } from '../js/rooms.js';
import { makePlacer, placeFurniture } from '../js/decor.js';
import { spriteEntries, spriteProblem } from '../js/sprites.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url));
const sprites = JSON.parse(read('sprites/sprites.json'));
const rooms = JSON.parse(read('rooms/ship.json'));

// A PNG's width and height, from its IHDR header.
function pngSize(bytes) {
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('every PNG sprites.json names is there and the right size', () => {
  const { entries, warnings } = spriteEntries(sprites);
  assert.deepEqual(warnings, []);
  assert.ok(entries.length > 0);
  entries.forEach(([name, entry]) => {
    const { width, height } = pngSize(read(entry.src));
    assert.equal(spriteProblem(name, entry, width, height), null);
  });
});

test('every piece in rooms/ship.json has a PNG or code art', () => {
  rooms.rooms.forEach(room => room.furniture.forEach(([piece]) => {
    assert.ok(FURNITURE_PIECES.includes(piece) || sprites.pieces[piece], room.name + ': nothing draws ' + piece);
  }));
});

test('the sample chicken stands in the Galley', () => {
  const plan = structuredClone(FLOOR_PLANS.ship);
  assert.deepEqual(applyRoomFurniture(plan, rooms), []);
  const layout = buildPlanLayout(plan);
  const warnings = [];
  const pieces = placeFurniture(layout, makePlacer(layout, plan.rows.length), w => warnings.push(w));
  assert.deepEqual(warnings, []);
  assert.ok(pieces.some(p => p.piece === 'chicken'));
});

test('a wrong-size PNG is turned away', () => {
  const tile = 16;
  const one = { src: 'x.png' };
  const wide = { src: 'x.png', parts: true };
  assert.equal(spriteProblem('x', one, tile, FURNITURE_SPRITES.maxTall), null);
  assert.equal(spriteProblem('x', one, tile, tile), null);
  assert.equal(spriteProblem('x', wide, tile * FURNITURE_SPRITES.frames.length, tile * 2), null);
  assert.ok(spriteProblem('x', one, tile * 2, tile));
  assert.ok(spriteProblem('x', wide, tile, tile));
  assert.ok(spriteProblem('x', one, tile, FURNITURE_SPRITES.maxTall + 1));
});

test('bad lines in sprites.json are skipped, not fatal', () => {
  const { entries, warnings } = spriteEntries({ pieces: { a: { src: 'a.png' }, b: {}, c: null, d: { src: '' } } });
  assert.deepEqual(entries.map(([name]) => name), ['a']);
  assert.equal(warnings.length, 3);
  assert.equal(spriteEntries(null).warnings.length, 1);
  assert.equal(spriteEntries({ pieces: 'no' }).warnings.length, 1);
});
