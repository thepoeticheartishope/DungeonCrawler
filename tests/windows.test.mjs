// Unit tests for the ship's windows (js/windows.js placeShipWindows) and
// the space picture seen through them (js/space.js).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';

// The ship's windows into space (windows.js placeShipWindows, space.js;
// Timothy 2026-11-02): every room gets one or two, never more, each on its
// own room's back wall with wall above it.
test('every ship room has one or two windows on its back wall', async () => {
  const { buildShipFloor } = await import('../js/floor.js');
  const { emptyFloor } = await import('./helpers.mjs');
  for (let run = 0; run < 20; run++) {
    emptyFloor(10);
    buildShipFloor();
    const f = state.floor;
    const rooms = new Set(f.chamberAt.values());
    rooms.forEach(room => {
      const here = f.windows.filter(w => w.room === room);
      assert.ok(here.length >= 1 && here.length <= 2, f.chamberNames[room] + ' has ' + here.length);
    });
    f.windows.forEach(w => {
      for (const c of [w.col - 1, w.col, w.col + 1, w.col + 2]) {
        assert.ok(f.wallSet.has(key(w.row, c)) && f.wallSet.has(key(w.row - 1, c)), 'wall at ' + w.row + ',' + c);
      }
      for (const c of [w.col, w.col + 1]) assert.equal(f.chamberAt.get(key(w.row + 1, c)), w.room);
      assert.ok(w.view.x >= 0 && w.view.x < 1 && w.view.y >= 0 && w.view.y < 1);
    });
  }
});

test('the space picture fills every pixel and is the same for the same seed', async () => {
  const { paintSpace } = await import('../js/space.js');
  const w = 60, h = 30;
  const a = new Uint8ClampedArray(w * h * 4), b = new Uint8ClampedArray(w * h * 4);
  paintSpace(a, w, h, 0.25);
  paintSpace(b, w, h, 0.25);
  for (let i = 3; i < a.length; i += 4) assert.equal(a[i], 255);
  assert.deepEqual(a, b);
  const c = new Uint8ClampedArray(w * h * 4);
  paintSpace(c, w, h, 0.75);
  assert.notDeepEqual(a, c);
});

// The windows scroll the picture slowly (Timothy 2026-11-02: moving
// through space), so it must wrap with no seam: its last column runs into
// its first about as smoothly as any two columns side by side.
test('the space picture wraps across with no seam', async () => {
  const { paintSpace } = await import('../js/space.js');
  const w = 240, h = 120;
  for (const seed of [0.1, 0.4, 0.7]) {
    const px = new Uint8ClampedArray(w * h * 4);
    paintSpace(px, w, h, seed);
    const step = (a, b) => {
      let sum = 0;
      for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) sum += Math.abs(px[(y * w + a) * 4 + c] - px[(y * w + b) * 4 + c]);
      return sum;
    };
    let usual = 0;
    for (let x = 0; x + 1 < w; x++) usual += step(x, x + 1);
    usual /= w - 1;
    assert.ok(step(w - 1, 0) <= usual * 2.5, 'seam ' + step(w - 1, 0) + ' vs usual ' + usual);
  }
});
