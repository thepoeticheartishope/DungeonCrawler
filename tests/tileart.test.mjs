// Unit tests for the TILE_ART table in config.js: every texture it names
// must exist in tileart.js, and every room theme must have a floor, so a
// typo or a new theme fails here instead of quietly drawing cobbles.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TILE_ART, ROOM_THEMES } from '../js/config.js';
import { hasTexture } from '../js/tileart.js';

test('every texture TILE_ART names can be drawn', () => {
  const { floors, ...parts } = TILE_ART;
  Object.entries({ ...parts, ...floors }).forEach(([where, name]) => {
    assert.ok(hasTexture(name), `TILE_ART ${where}: no texture called '${name}' in tileart.js`);
  });
});

test('every room theme has its own floor texture', () => {
  Object.keys(ROOM_THEMES).forEach(theme => {
    assert.ok(TILE_ART.floors[theme], `TILE_ART.floors has no entry for the '${theme}' theme`);
  });
});
